"""
CPE → Excel
App web: subís tu Excel de avance de cosecha y los PDFs de Cartas de Porte, revisás
y descargás el Excel actualizado. Todo se procesa en memoria; nada queda en el servidor.
Ejecutar:  streamlit run app.py
"""
from __future__ import annotations

import hmac
import io
import os
from datetime import date

import pandas as pd
import streamlit as st

from excel_writer import (FilaNueva, analizar_libro, campo_canonico, guardar_filas,
                          transportista_corto, ETIQUETAS)
from extractor import leer_cpe

MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

st.set_page_config(page_title="CPE → Excel", page_icon="🚛", layout="wide")


# ---------- acceso con contraseña (opcional: APP_PASSWORD en secrets o variable de entorno) ----------
def clave_configurada() -> str:
    try:
        clave = st.secrets.get("APP_PASSWORD", "")
    except Exception:  # no hay secrets.toml
        clave = ""
    return clave or os.environ.get("APP_PASSWORD", "")


def pedir_clave() -> None:
    clave = clave_configurada()
    if not clave or st.session_state.get("autorizado"):
        return
    st.title("🚛 Cartas de Porte → Excel")
    with st.form("login"):
        intento = st.text_input("Contraseña", type="password")
        if st.form_submit_button("Entrar", type="primary"):
            if hmac.compare_digest(intento.encode(), clave.encode()):
                st.session_state["autorizado"] = True
                st.rerun()
            st.error("Contraseña incorrecta.")
    st.stop()


@st.cache_data(show_spinner="Leyendo el Excel...", max_entries=20)
def cargar_libro(contenido: bytes):
    return analizar_libro(contenido)


@st.cache_data(show_spinner=False, max_entries=500)
def cargar_pdf(nombre: str, contenido: bytes):
    return leer_cpe(io.BytesIO(contenido), archivo=nombre)


def fmt_kg(n) -> str:
    return f"{n:,.0f}".replace(",", ".") if n is not None else "—"


def boton_descarga(key: str) -> None:
    st.download_button(
        f"⬇️ Descargar Excel actualizado ({estado['cambios']} fila(s) nuevas)",
        data=estado["excel_bytes"], file_name=estado["excel_nombre"], mime=MIME_XLSX,
        type="primary", key=key, use_container_width=True,
    )


pedir_clave()
estado = st.session_state

# ---------- barra lateral ----------
with st.sidebar:
    st.header("Excel de avance de cosecha")
    subido = st.file_uploader("Subí el archivo .xlsx", type="xlsx")
    if subido is None:
        for k in ("excel_id", "excel_nombre", "excel_bytes", "cambios", "resultado"):
            estado.pop(k, None)
    elif estado.get("excel_id") != subido.file_id:
        estado.update(excel_id=subido.file_id, excel_nombre=subido.name,
                      excel_bytes=subido.getvalue(), cambios=0)
        estado.pop("resultado", None)
    agregar_cols = st.checkbox("Si a una hoja le falta Patente/Fecha/Transportista, agregar la columna",
                               key="agregar_cols")
    if estado.get("cambios"):
        boton_descarga("descarga_lateral")
        st.caption("⚠️ Si cerrás o recargás la página sin descargar, se pierden los cambios.")
    st.caption("Tu archivo original no se modifica: descargás una copia con las filas agregadas. "
               "Los archivos se procesan en memoria y no quedan guardados en el servidor.")

st.title("🚛 Cartas de Porte → Excel")

if "excel_bytes" not in estado:
    st.info("Subí en la barra lateral tu Excel de avance de cosecha para empezar.")
    st.stop()

try:
    libro = cargar_libro(estado["excel_bytes"])
except Exception as e:
    st.error(f"No pude abrir el Excel: {e}")
    st.stop()

if not libro.hojas:
    st.error("No encontré hojas de CPE (hojas con columnas 'CTG' y 'CPE' en la fila 1).")
    st.stop()

if res := estado.get("resultado"):
    filas = ", ".join(f"{h} fila {f}" for h, f in res["filas"])
    st.success(f"Listo ✔ Se cargaron {len(res['filas'])} fila(s): {filas}")
    for a in res["avisos"]:
        st.info(a)
    boton_descarga("descarga_principal")

nombres_hojas = list(libro.hojas)
st.caption("Hojas de CPE detectadas: " + " · ".join(nombres_hojas))

# La key cambia después de cada guardado para vaciar la lista de PDFs ya cargados
archivos = st.file_uploader("Arrastrá uno o varios PDF de CPE", type="pdf", accept_multiple_files=True,
                            key=f"pdfs_{estado.get('tanda', 0)}")
if not archivos:
    st.stop()

# ---------- revisión de cada CPE ----------
pendientes: list[FilaNueva] = []
errores: list[str] = []
ctgs_en_tanda: dict[str, str] = {}

for archivo in archivos:
    cpe = cargar_pdf(archivo.name, archivo.getvalue())
    uid = f"{archivo.name}_{cpe.ctg}"
    titulo = f"CPE {cpe.nro_cpe or '?'} · CTG {cpe.ctg or '?'} · {cpe.grano} · {fmt_kg(cpe.peso_neto)} kg"

    with st.container(border=True):
        cab1, cab2 = st.columns([5, 1])
        cab1.subheader(titulo)
        incluir = cab2.toggle("Cargar", value=True, key=f"inc_{uid}")
        for adv in cpe.advertencias:
            st.warning(adv)

        dups = libro.duplicados(cpe.ctg)
        repetido_tanda = cpe.ctg in ctgs_en_tanda
        forzar = True
        if dups or repetido_tanda:
            donde = ", ".join(f"'{h}' fila {f}" for h, f in dups) or f"otro PDF de esta tanda ({ctgs_en_tanda[cpe.ctg]})"
            st.error(f"⚠️ Este CTG ya está cargado en {donde}.")
            forzar = st.checkbox("Cargarla igual", value=False, key=f"forz_{uid}")
        ctgs_en_tanda.setdefault(cpe.ctg, archivo.name)

        with st.expander("Datos leídos del PDF"):
            st.write({
                "Fecha": cpe.fecha, "Grano / Tipo": f"{cpe.grano} – {cpe.tipo_grano}", "Campaña": cpe.campania,
                "Bruto / Tara / Neto": f"{fmt_kg(cpe.peso_bruto)} / {fmt_kg(cpe.peso_tara)} / {fmt_kg(cpe.peso_neto)}",
                "Observaciones": cpe.observaciones, "Dominios": f"{cpe.patente} {cpe.patente_acoplado}".strip(),
                "Transportista": f"{cpe.transportista} ({cpe.transportista_cuit})", "Chofer": cpe.chofer,
                "Origen → Destino": f"{cpe.localidad_origen} → {cpe.localidad_destino}",
                "Destinatario": cpe.destinatario,
                "Neto en descarga": fmt_kg(cpe.neto_descarga) if cpe.neto_descarga else "sin descargar",
            })

        sugerida = libro.sugerir_hoja(cpe.grano, cpe.ctg) or nombres_hojas[0]
        c1, c2, c3 = st.columns(3)
        hoja_nombre = c1.selectbox("Hoja destino", nombres_hojas, index=nombres_hojas.index(sugerida),
                                   key=f"hoja_{uid}", help="Sugerida según el grano y los CTG de cada hoja.")
        hoja = libro.hojas[hoja_nombre]
        cultivo = c2.text_input("Cultivo", value=hoja.cultivo_etiqueta or cpe.grano, key=f"cult_{uid}_{hoja_nombre}")
        campo = c3.text_input("Campo", value=campo_canonico(cpe.observaciones, hoja.campos),
                              key=f"campo_{uid}_{hoja_nombre}")

        d1, d2, d3 = st.columns(3)
        patente = d1.text_input("Patente", value=cpe.patente, key=f"pat_{uid}")
        fecha = d2.date_input("Fecha", value=cpe.fecha or date.today(), format="DD/MM/YYYY", key=f"fec_{uid}")
        transp = d3.text_input("Transportista", value=transportista_corto(cpe.transportista, cpe.transportista_cuit),
                               key=f"tr_{uid}")
        if hoja.faltantes and not agregar_cols:
            st.caption("ℹ️ Esta hoja no tiene columna: " + ", ".join(ETIQUETAS[f] for f in hoja.faltantes)
                       + " — esos datos no se van a cargar.")

        st.markdown("**Lotes y kilos** — agregá una fila por lote si la carga se repartió.")
        conocidos = hoja.lotes_por_campo.get(campo_canonico(campo, hoja.campos), [])
        if conocidos:
            st.caption(f"Lotes ya usados en {campo}: " + ", ".join(conocidos[:15]))
        tabla = st.data_editor(
            pd.DataFrame([{"Lote": "", "Kgs": cpe.peso_neto or 0}]),
            num_rows="dynamic", key=f"lotes_{uid}",
            column_config={
                "Lote": st.column_config.TextColumn("Lote", required=True, width="medium"),
                "Kgs": st.column_config.NumberColumn("Kgs", min_value=0, step=10, format="%d", required=True, width="medium"),
            },
        )
        tabla = tabla.dropna(how="all")
        tabla["Lote"] = tabla["Lote"].fillna("").astype(str).str.strip()
        tabla["Kgs"] = pd.to_numeric(tabla["Kgs"], errors="coerce").fillna(0).astype(int)
        suma = int(tabla["Kgs"].sum())
        neto = cpe.peso_neto or 0
        ok_suma = suma == neto
        if ok_suma:
            st.success(f"Suma {fmt_kg(suma)} kg = neto de la CPE ✔")
        else:
            st.warning(f"La suma de lotes ({fmt_kg(suma)} kg) no coincide con el neto ({fmt_kg(neto)} kg). "
                       f"Diferencia: {fmt_kg(neto - suma)} kg")
            ok_suma = st.checkbox("Cargar igual con esta suma", key=f"okdif_{uid}")

        if not incluir:
            continue
        problemas = []
        if not forzar:
            problemas.append("CTG duplicado")
        if (tabla["Lote"] == "").any() or tabla.empty:
            problemas.append("falta completar el lote")
        if (tabla["Kgs"] <= 0).any():
            problemas.append("hay lotes con 0 kg")
        if not ok_suma:
            problemas.append("la suma de kilos no coincide")
        if not campo.strip():
            problemas.append("falta el campo")
        if problemas:
            errores.append(f"{cpe.nro_cpe or archivo.name}: " + ", ".join(problemas))
            continue
        for _, r in tabla.iterrows():
            pendientes.append(FilaNueva(
                hoja=hoja_nombre, cultivo=cultivo.strip(), campo=campo.strip(), lote=r["Lote"], kgs=int(r["Kgs"]),
                ctg=cpe.ctg, cpe=cpe.nro_cpe, patente=patente.strip(), fecha=fecha, transportista=transp.strip(),
            ))

# ---------- guardar ----------
st.divider()
if errores:
    st.error("Para guardar, revisá:\n\n" + "\n".join(f"- {e}" for e in errores))

if pendientes:
    st.write(f"**{len(pendientes)} fila(s) listas para cargar:**")
    st.dataframe(pd.DataFrame([vars(f) for f in pendientes]), hide_index=True)

if st.button("💾 Agregar al Excel", type="primary", disabled=bool(errores) or not pendientes):
    try:
        res = guardar_filas(estado["excel_bytes"], pendientes, agregar_columnas_faltantes=agregar_cols)
    except Exception as e:
        st.error(f"Error al guardar: {e}")
    else:
        estado["excel_bytes"] = res.pop("contenido")
        estado["cambios"] = estado.get("cambios", 0) + len(res["filas"])
        estado["resultado"] = res
        estado["tanda"] = estado.get("tanda", 0) + 1
        st.rerun()
