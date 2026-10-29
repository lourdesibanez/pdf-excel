"""
Extractor de Cartas de Porte Electrónicas (CPE) de ARCA/AFIP.

Lee el PDF (digital, no escaneado) y devuelve un diccionario con los datos.
Como el formato de la CPE es oficial y siempre igual, alcanza con expresiones
regulares sobre el texto: no hace falta IA.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import BinaryIO

import pdfplumber


@dataclass
class CPE:
    archivo: str = ""
    nro_cpe: str = ""            # 00001-00026528
    ctg: str = ""                # 10134300029
    fecha: date | None = None    # fecha de emisión de la CPE
    grano: str = ""              # Maíz / Soja / Girasol...
    tipo_grano: str = ""         # Maiz Flynt o Plata
    campania: str = ""           # 2526
    peso_bruto: int | None = None
    peso_tara: int | None = None
    peso_neto: int | None = None
    observaciones: str = ""      # en tus CPE: el campo de origen
    patente: str = ""            # chasis (primer dominio)
    patente_acoplado: str = ""
    transportista: str = ""      # nombre tal cual figura
    transportista_cuit: str = ""
    chofer: str = ""
    titular: str = ""
    destinatario: str = ""
    localidad_origen: str = ""
    localidad_destino: str = ""
    # Datos de descarga (si la CPE ya fue descargada)
    neto_descarga: int | None = None
    advertencias: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _buscar(patron: str, texto: str, flags=0) -> str:
    m = re.search(patron, texto, flags)
    return m.group(1).strip() if m else ""


def _entero(valor: str) -> int | None:
    valor = valor.replace(".", "").replace(",", "").strip()
    return int(valor) if valor.isdigit() else None


def _fecha(valor: str) -> date | None:
    try:
        return datetime.strptime(valor.strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def _cuit_nombre(linea: str) -> tuple[str, str]:
    """'20237684436 - BARBESINI CLAUDIO OSCAR' -> ('20237684436', 'BARBESINI CLAUDIO OSCAR')"""
    m = re.match(r"(\d{11})\s*-\s*(.+)", linea.strip())
    return (m.group(1), m.group(2).strip()) if m else ("", linea.strip())


def texto_pdf(fuente: str | BinaryIO) -> str:
    with pdfplumber.open(fuente) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)


def parsear_texto(texto: str, archivo: str = "") -> CPE:
    c = CPE(archivo=archivo)

    if "Carta de Porte" not in texto:
        c.advertencias.append("El PDF no parece una Carta de Porte Electrónica.")

    c.nro_cpe = _buscar(r"(\d{5}-\d{8})", texto)
    c.ctg = _buscar(r"CTG:\s*(\d+)", texto)
    c.fecha = _fecha(_buscar(r"Carta de Porte Electr[oó]nica\s+Fecha:\s*(\d{2}/\d{2}/\d{4})", texto)
                     or _buscar(r"Fecha:\s*(\d{2}/\d{2}/\d{4})", texto))

    # Sección B - Grano
    c.grano = _buscar(r"Grano\s*/\s*(.+?)\s+Tipo:", texto)
    c.tipo_grano = _buscar(r"Tipo:\s*(.+?)\s+Campa[ñn]a:", texto)
    c.campania = _buscar(r"Campa[ñn]a:\s*(\d+)", texto)
    c.peso_bruto = _entero(_buscar(r"Peso Bruto\s+([\d\.]+)", texto))
    c.peso_tara = _entero(_buscar(r"Peso Tara\s+([\d\.]+)", texto))
    c.peso_neto = _entero(_buscar(r"Peso Neto\s+([\d\.]+)", texto))
    if c.peso_neto is None and c.peso_bruto and c.peso_tara:
        c.peso_neto = c.peso_bruto - c.peso_tara
    c.observaciones = _buscar(r"Observaciones:[ \t]*(.*)", texto)

    # Sección A - Intervinientes
    c.transportista_cuit, c.transportista = _cuit_nombre(_buscar(r"Empresa Transportista:[ \t]*(.*)", texto))
    _, c.chofer = _cuit_nombre(_buscar(r"Chofer\s*:[ \t]*(.*)", texto))
    _, c.titular = _cuit_nombre(_buscar(r"Titular Carta de Porte:[ \t]*(.*)", texto))
    _, c.destinatario = _cuit_nombre(_buscar(r"Destinatario:[ \t]*(.*)", texto))

    # Sección E - Transporte
    dominios = _buscar(r"Dominios:[ \t]*(.*)", texto)
    partes = [p.strip() for p in dominios.split("-") if p.strip()]
    if partes:
        c.patente = partes[0]
        c.patente_acoplado = partes[1] if len(partes) > 1 else ""

    # Secciones C / D - localidades (la 1ra es procedencia, la 2da destino)
    locs = re.findall(r"Localidad:\s*(.+?)\s+Provincia", texto)
    if locs:
        c.localidad_origen = locs[0].strip()
    if len(locs) > 1:
        c.localidad_destino = locs[1].strip()

    # Sección G - Descarga (puede venir vacía)
    c.neto_descarga = _entero(_buscar(r"Peso Neto \(kg\):\s*([\d\.]+)", texto))

    for campo, nombre in [("nro_cpe", "N° CPE"), ("ctg", "CTG"), ("peso_neto", "Peso neto"),
                          ("grano", "Grano"), ("fecha", "Fecha")]:
        if not getattr(c, campo):
            c.advertencias.append(f"No se pudo leer: {nombre}")
    return c


def leer_cpe(fuente: str | BinaryIO, archivo: str = "") -> CPE:
    return parsear_texto(texto_pdf(fuente), archivo=archivo or str(getattr(fuente, "name", fuente)))


if __name__ == "__main__":
    import sys, json
    for ruta in sys.argv[1:]:
        print(json.dumps(leer_cpe(ruta).to_dict(), default=str, ensure_ascii=False, indent=2))
