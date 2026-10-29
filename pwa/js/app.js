// CPE → Excel (PWA). Todo corre en el teléfono: el PDF y el Excel nunca salen de acá.
import * as pdfjs from "../vendor/pdf.min.mjs";
import { leerCpe } from "./extractor.js";
import { analizarLibro, guardarFilas, campoCanonico, transportistaCorto, ETIQUETAS } from "./excel.js";
import * as store from "./store.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ICONOS = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  compartir: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  archivo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  alerta: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  ok: '<path d="M20 6L9 17l-5-5"/>',
};

const estado = {
  excel: null,        // {nombre, bytes, cambios}: el Excel de trabajo, guardado en el teléfono
  libro: null,        // análisis del Excel (hojas, CTG cargados...)
  tarjetas: [],       // una por PDF de CPE pendiente de cargar
  agregarCols: false,
  resultado: null,    // último "Agregar al Excel"
};
let siguienteId = 1;

// ---------- utilidades de DOM ----------
function h(tag, props, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of hijos.flat(Infinity)) {
    if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// Como replaceChildren, pero aplana listas e ignora null/false (para los condicionales)
function poner(el, ...hijos) {
  el.replaceChildren(...hijos.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
}

function icono(nombre) {
  const span = h("span", { class: "icono", "aria-hidden": "true" });
  span.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre]}</svg>`;
  return span;
}

const fmtKg = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("es-AR"));
const fmtFecha = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const hoyIso = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local

function campoForm(etiqueta, control, clase = "") {
  return h("label", { class: `campo ${clase}` }, h("span", { class: "etiqueta" }, etiqueta), control);
}

// ---------- avisos y espera ----------
function mostrarError(mensaje) {
  const aviso = document.getElementById("aviso");
  poner(aviso, 
    icono("alerta"),
    h("p", {}, mensaje),
    h("button", { type: "button", class: "boton-icono", "aria-label": "Cerrar aviso", onclick: () => { aviso.hidden = true; } }, icono("x")),
  );
  aviso.hidden = false;
  aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function conEspera(mensaje, tarea) {
  const espera = document.getElementById("espera");
  espera.querySelector("p").textContent = mensaje;
  espera.hidden = false;
  document.getElementById("aviso").hidden = true;
  try {
    await tarea();
  } catch (e) {
    console.error(e);
    mostrarError(e.message || String(e));
  } finally {
    espera.hidden = true;
    render();
  }
}

// ---------- Excel ----------
async function usarExcel(excel) {
  const libro = await analizarLibro(excel.bytes);
  if (!Object.keys(libro.hojas).length) {
    throw new Error("No encontré hojas de CPE en ese Excel (hojas con columnas 'CTG' y 'CPE' en la fila 1).");
  }
  estado.excel = excel;
  estado.libro = libro;
  for (const t of estado.tarjetas) aplicarHoja(t, libro.sugerirHoja(t.cpe.grano, t.cpe.ctg));
}

function alElegirExcel(ev) {
  const archivo = ev.target.files[0];
  ev.target.value = "";
  if (!archivo) return;
  const pendientes = estado.excel?.cambios || 0;
  if (pendientes && !confirm(`Tenés ${pendientes} fila(s) agregadas que todavía no exportaste. Si cambiás de Excel se pierden. ¿Seguir?`)) return;
  conEspera("Leyendo el Excel…", async () => {
    await usarExcel({ nombre: archivo.name, bytes: new Uint8Array(await archivo.arrayBuffer()), cambios: 0 });
    estado.resultado = null;
    await store.guardar("excel", estado.excel);
  });
}

async function exportar() {
  const { nombre, bytes } = estado.excel;
  const archivo = new File([bytes], nombre, { type: MIME_XLSX });
  const tactil = matchMedia("(pointer: coarse)").matches;
  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] }); // iPhone: "Guardar en Archivos", WhatsApp, Mail...
    } catch (e) {
      if (e.name === "AbortError") return;
      descargar(archivo);
    }
  } else {
    descargar(archivo);
  }
  estado.excel.cambios = 0;
  await store.guardar("excel", estado.excel);
  render();
}

function descargar(archivo) {
  const url = URL.createObjectURL(archivo);
  const a = h("a", { href: url, download: archivo.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------- PDFs ----------
function aplicarHoja(t, nombre) {
  const hoja = estado.libro.hojas[nombre] || Object.values(estado.libro.hojas)[0];
  t.hoja = hoja.nombre;
  t.cultivo = hoja.cultivoEtiqueta || t.cpe.grano;
  t.campo = campoCanonico(t.cpe.observaciones, hoja.campos);
}

function nuevaTarjeta(cpe) {
  const t = {
    id: siguienteId++, cpe, forzar: false, okDif: false,
    patente: cpe.patente, fecha: cpe.fecha || hoyIso(),
    transportista: transportistaCorto(cpe.transportista, cpe.transportistaCuit),
    lotes: [{ lote: "", kgs: cpe.pesoNeto || 0 }],
  };
  aplicarHoja(t, estado.libro.sugerirHoja(cpe.grano, cpe.ctg));
  return t;
}

function alElegirPdfs(ev) {
  const archivos = [...ev.target.files];
  ev.target.value = "";
  if (!archivos.length) return;
  conEspera(archivos.length > 1 ? `Leyendo ${archivos.length} PDF…` : "Leyendo el PDF…", async () => {
    const fallidos = [];
    for (const archivo of archivos) {
      try {
        const cpe = await leerCpe(new Uint8Array(await archivo.arrayBuffer()), pdfjs, archivo.name);
        estado.tarjetas.push(nuevaTarjeta(cpe));
      } catch (e) {
        fallidos.push(`${archivo.name}: ${e.message}`);
      }
    }
    estado.resultado = null;
    if (fallidos.length) throw new Error("No pude leer: " + fallidos.join(" · "));
  });
}

// ---------- validación ----------
function analizarTarjetas() {
  const vistos = new Map();
  return estado.tarjetas.map((t) => {
    const dups = estado.libro.duplicados(t.cpe.ctg).map(([hoja, fila]) => `'${hoja}' fila ${fila}`);
    if (t.cpe.ctg && vistos.has(t.cpe.ctg)) dups.push(`otro PDF de esta tanda (${vistos.get(t.cpe.ctg)})`);
    else vistos.set(t.cpe.ctg, t.cpe.archivo);
    const suma = t.lotes.reduce((s, l) => s + (l.kgs || 0), 0);
    const neto = t.cpe.pesoNeto || 0;
    const problemas = [];
    if (dups.length && !t.forzar) problemas.push("CTG duplicado");
    if (!t.lotes.length || t.lotes.some((l) => !l.lote.trim())) problemas.push("falta completar el lote");
    if (t.lotes.some((l) => !(l.kgs > 0))) problemas.push("hay lotes con 0 kg");
    if (suma !== neto && !t.okDif) problemas.push("la suma de kilos no coincide");
    if (!t.campo.trim()) problemas.push("falta el campo");
    return { t, dups, suma, neto, problemas };
  });
}

function filasParaGuardar() {
  return estado.tarjetas.flatMap((t) => t.lotes.map((l) => ({
    hoja: t.hoja, cultivo: t.cultivo.trim(), campo: t.campo.trim(), lote: l.lote.trim(), kgs: l.kgs,
    ctg: t.cpe.ctg, cpe: t.cpe.nroCpe, patente: t.patente.trim(), fecha: t.fecha, transportista: t.transportista.trim(),
  })));
}

function agregarAlExcel() {
  conEspera("Agregando al Excel…", async () => {
    const res = await guardarFilas(estado.excel.bytes, filasParaGuardar(), estado.agregarCols);
    const excel = { ...estado.excel, bytes: res.contenido, cambios: estado.excel.cambios + res.filas.length };
    await usarExcel(excel);
    await store.guardar("excel", excel);
    estado.tarjetas = [];
    estado.resultado = res;
    scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------- render ----------
function render() {
  renderExcel();
  renderResultado();
  renderTarjetas();
}

function renderExcel() {
  const panel = document.getElementById("panel-excel");
  const selector = h("input", {
    type: "file", id: "input-excel", class: "oculto-visual",
    accept: `.xlsx,${MIME_XLSX}`, onchange: alElegirExcel,
  });
  if (!estado.excel) {
    poner(panel, 
      h("h2", {}, "1. Tu Excel de avance de cosecha"),
      h("p", { class: "ayuda" }, "Elegilo una vez: queda guardado en este teléfono y las cartas de porte se van agregando ahí. Los datos no salen del teléfono."),
      selector,
      h("label", { for: "input-excel", class: "boton primario grande" }, icono("archivo"), "Elegir Excel (.xlsx)"),
    );
    return;
  }
  const { nombre, cambios } = estado.excel;
  poner(panel, 
    h("div", { class: "excel-cabecera" },
      icono("archivo"),
      h("div", {},
        h("p", { class: "excel-nombre" }, nombre),
        h("p", { class: "ayuda" }, "Hojas de CPE: " + Object.keys(estado.libro.hojas).join(" · ")),
      ),
    ),
    cambios
      ? h("p", { class: "pendiente" }, `${cambios} fila(s) agregadas sin exportar`)
      : null,
    h("div", { class: "acciones" },
      h("button", { type: "button", class: `boton ${cambios ? "primario" : ""}`, onclick: exportar }, icono("compartir"), "Exportar"),
      selector,
      h("label", { for: "input-excel", class: "boton" }, "Cambiar Excel"),
    ),
    h("label", { class: "check" },
      h("input", {
        type: "checkbox", checked: estado.agregarCols,
        onchange: async (e) => {
          estado.agregarCols = e.target.checked;
          await store.guardar("prefs", { agregarCols: estado.agregarCols });
          render();
        },
      }),
      h("span", {}, "Si a una hoja le falta Patente / Fecha / Transportista, agregar la columna"),
    ),
  );
}

function renderResultado() {
  const panel = document.getElementById("resultado");
  const res = estado.resultado;
  panel.hidden = !res;
  if (!res) return;
  poner(panel, 
    h("p", { class: "titulo-ok" }, icono("ok"), `Listo: se agregaron ${res.filas.length} fila(s)`),
    h("p", { class: "ayuda" }, res.filas.map(([hoja, fila]) => `${hoja} fila ${fila}`).join(" · ")),
    res.avisos.map((a) => h("p", { class: "ayuda" }, a)),
    h("p", { class: "ayuda" }, "Cuando termines, tocá Exportar para guardarlo en Archivos o mandarlo."),
  );
}

function renderTarjetas() {
  const zona = document.getElementById("zona-pdfs");
  const pie = document.getElementById("pie");
  if (!estado.excel) {
    poner(zona);
    pie.hidden = true;
    return;
  }
  const infos = analizarTarjetas();
  poner(zona, 
    h("h2", {}, "2. Cartas de porte"),
    h("input", { type: "file", id: "input-pdf", class: "oculto-visual", accept: "application/pdf,.pdf", multiple: true, onchange: alElegirPdfs }),
    h("label", { for: "input-pdf", class: `boton grande ${estado.tarjetas.length ? "" : "primario"}` }, icono("mas"), "Agregar PDFs de CPE"),
    infos.map(renderTarjeta),
  );
  renderPie(infos);
}

function refrescar() {
  const infos = analizarTarjetas();
  for (const info of infos) actualizarEstadoTarjeta(info);
  renderPie(infos);
}

function renderPie(infos) {
  const pie = document.getElementById("pie");
  pie.hidden = !infos.length;
  if (!infos.length) return;
  const conProblemas = infos.filter((i) => i.problemas.length).length;
  const filas = infos.reduce((n, i) => n + i.t.lotes.length, 0);
  poner(pie, 
    h("p", { class: conProblemas ? "pie-error" : "" },
      conProblemas ? `Revisá ${conProblemas} carta(s) marcadas en rojo` : `${filas} fila(s) listas para agregar`),
    h("button", { type: "button", class: "boton primario", disabled: conProblemas > 0, onclick: agregarAlExcel }, "Agregar al Excel"),
  );
}

function entrada(objeto, clave, props = {}) {
  return h("input", {
    type: "text", value: objeto[clave] ?? "", autocomplete: "off",
    oninput: (e) => { objeto[clave] = e.target.value; refrescar(); },
    ...props,
  });
}

function renderTarjeta(info) {
  const { t, dups } = info;
  const { cpe } = t;
  const hoja = estado.libro.hojas[t.hoja];
  const selectorHoja = h("select", { onchange: (e) => { aplicarHoja(t, e.target.value); render(); } },
    Object.keys(estado.libro.hojas).map((n) => h("option", { value: n }, n)));
  selectorHoja.value = t.hoja;

  const quitar = () => { estado.tarjetas = estado.tarjetas.filter((x) => x !== t); render(); };
  const restante = () => Math.max(0, (cpe.pesoNeto || 0) - t.lotes.reduce((s, l) => s + (l.kgs || 0), 0));

  t.el = {
    estado: h("div", { class: "estado-suma" }),
    problemas: h("p", { class: "problemas" }),
    lotesConocidos: h("datalist", { id: `lotes-${t.id}` }),
    tarjeta: null,
  };

  t.el.tarjeta = h("article", { class: "tarjeta" },
    h("header", { class: "tarjeta-cabecera" },
      h("div", {},
        h("h3", {}, `${cpe.grano || "?"} · ${fmtKg(cpe.pesoNeto)} kg`),
        h("p", { class: "ayuda" }, `CPE ${cpe.nroCpe || "?"} · CTG ${cpe.ctg || "?"} · ${fmtFecha(cpe.fecha)}`),
      ),
      h("button", { type: "button", class: "boton-icono", "aria-label": `Quitar CPE ${cpe.nroCpe}`, onclick: quitar }, icono("x")),
    ),
    cpe.advertencias.map((a) => h("p", { class: "alerta" }, icono("alerta"), a)),
    dups.length
      ? h("div", { class: "alerta" },
        icono("alerta"),
        h("div", {},
          h("p", {}, `Este CTG ya está cargado en ${dups.join(", ")}.`),
          h("label", { class: "check" },
            h("input", { type: "checkbox", checked: t.forzar, onchange: (e) => { t.forzar = e.target.checked; refrescar(); } }),
            h("span", {}, "Cargarla igual"),
          ),
        ))
      : null,
    h("details", { class: "detalle" },
      h("summary", {}, "Datos leídos del PDF"),
      h("dl", {},
        [
          ["Grano / Tipo", `${cpe.grano} – ${cpe.tipoGrano}`], ["Campaña", cpe.campania],
          ["Bruto / Tara / Neto", `${fmtKg(cpe.pesoBruto)} / ${fmtKg(cpe.pesoTara)} / ${fmtKg(cpe.pesoNeto)}`],
          ["Observaciones", cpe.observaciones], ["Dominios", `${cpe.patente} ${cpe.patenteAcoplado}`.trim()],
          ["Transportista", `${cpe.transportista} (${cpe.transportistaCuit})`], ["Chofer", cpe.chofer],
          ["Origen → Destino", `${cpe.localidadOrigen} → ${cpe.localidadDestino}`], ["Destinatario", cpe.destinatario],
          ["Neto en descarga", cpe.netoDescarga ? fmtKg(cpe.netoDescarga) : "sin descargar"],
        ].map(([k, v]) => [h("dt", {}, k), h("dd", {}, v || "—")]),
      ),
    ),
    h("div", { class: "grilla" },
      campoForm("Hoja destino", selectorHoja),
      campoForm("Cultivo", entrada(t, "cultivo")),
      campoForm("Campo", entrada(t, "campo", { list: `campos-${t.id}` })),
      h("datalist", { id: `campos-${t.id}` }, hoja.campos.map((c) => h("option", { value: c }))),
      campoForm("Patente", entrada(t, "patente", { autocapitalize: "characters" })),
      campoForm("Fecha", h("input", { type: "date", value: t.fecha, onchange: (e) => { t.fecha = e.target.value; refrescar(); } })),
      campoForm("Transportista", entrada(t, "transportista")),
    ),
    hoja.faltantes.length && !estado.agregarCols
      ? h("p", { class: "ayuda" }, `Esta hoja no tiene columna ${hoja.faltantes.map((f) => ETIQUETAS[f]).join(", ")}: esos datos no se van a cargar.`)
      : null,
    h("h4", {}, "Lotes y kilos"),
    h("p", { class: "ayuda" }, "Si la carga se repartió, agregá un lote por cada parte."),
    t.el.lotesConocidos,
    t.lotes.map((l, i) => h("div", { class: "lote" },
      campoForm("Lote", entrada(l, "lote", { list: `lotes-${t.id}` })),
      campoForm("Kgs", h("input", {
        type: "text", inputmode: "numeric", pattern: "[0-9]*", value: l.kgs ? String(l.kgs) : "", autocomplete: "off",
        oninput: (e) => { l.kgs = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0; refrescar(); },
      })),
      t.lotes.length > 1
        ? h("button", { type: "button", class: "boton-icono", "aria-label": `Quitar lote ${i + 1}`, onclick: () => { t.lotes.splice(i, 1); render(); } }, icono("x"))
        : null,
    )),
    h("button", { type: "button", class: "boton chico", onclick: () => { t.lotes.push({ lote: "", kgs: restante() }); render(); } }, icono("mas"), "Agregar lote"),
    t.el.estado,
    t.el.problemas,
  );
  actualizarEstadoTarjeta(info);
  return t.el.tarjeta;
}

function actualizarEstadoTarjeta({ t, suma, neto, problemas }) {
  const hoja = estado.libro.hojas[t.hoja];
  const conocidos = hoja.lotesPorCampo[campoCanonico(t.campo, hoja.campos)] || [];
  poner(t.el.lotesConocidos, ...conocidos.slice(0, 30).map((l) => h("option", { value: l })));

  if (suma === neto) {
    poner(t.el.estado, h("p", { class: "ok" }, icono("ok"), `Suma ${fmtKg(suma)} kg = neto de la CPE`));
  } else {
    poner(t.el.estado, 
      h("p", { class: "advertencia" }, `La suma de lotes (${fmtKg(suma)} kg) no coincide con el neto (${fmtKg(neto)} kg). Diferencia: ${fmtKg(neto - suma)} kg`),
      h("label", { class: "check" },
        h("input", { type: "checkbox", checked: t.okDif, onchange: (e) => { t.okDif = e.target.checked; refrescar(); } }),
        h("span", {}, "Cargar igual con esta suma"),
      ),
    );
  }
  t.el.problemas.textContent = problemas.length ? "Falta: " + problemas.join(", ") : "";
  t.el.tarjeta?.classList.toggle("con-problemas", problemas.length > 0);
}

// ---------- inicio ----------
function consejoInstalar() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  let descartado = false;
  try { descartado = localStorage.getItem("consejo-instalar") === "no"; } catch { /* sin storage */ }
  const consejo = document.getElementById("consejo");
  consejo.hidden = !ios || instalada || descartado;
  consejo.querySelector("button").addEventListener("click", () => {
    consejo.hidden = true;
    try { localStorage.setItem("consejo-instalar", "no"); } catch { /* sin storage */ }
  });
}

async function iniciar() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
  navigator.storage?.persist?.().catch(() => {});
  consejoInstalar();
  try {
    estado.agregarCols = !!(await store.leer("prefs"))?.agregarCols;
    const excel = await store.leer("excel");
    if (excel) await usarExcel(excel);
  } catch (e) {
    console.error(e);
    mostrarError("No pude abrir el Excel guardado: " + (e.message || e) + ". Elegilo de nuevo.");
  }
  render();
}

iniciar();
