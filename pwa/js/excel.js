// Escritura de CPE en el Excel de avance de cosecha. Port de excel_writer.py sobre ExcelJS.
// - Trabaja en memoria: recibe el .xlsx como bytes y devuelve el .xlsx nuevo como bytes.
// - Detecta las hojas de CPE (las que tienen columnas CTG y CPE en la fila 1).
// - Ubica cada columna por el nombre del encabezado, no por la posición.
// - Sugiere la hoja destino según el grano y los CTG más cercanos. Avisa si el CTG ya está cargado.
// - Agrega las filas al final copiando el formato de la fila de arriba.

// Nombre lógico -> textos posibles del encabezado (normalizados)
const SINONIMOS = {
  cultivo: ["cultivo"],
  campo: ["campo"],
  lote: ["lote"],
  kgs: ["kgs neto", "kg neto", "kilos neto", "kilos", "kgs", "neto"],
  ctg: ["nro ctg", "n ctg", "ctg"],
  cpe: ["cpe", "nro cpe", "n cpe"],
  patente: ["patente", "dominio", "patentes"],
  fecha: ["fecha"],
  transportista: ["transportista", "transporte", "empresa transportista"],
};
export const COLUMNAS_EXTRA = ["patente", "fecha", "transportista"];
export const ETIQUETAS = {
  cultivo: "Cultivo", campo: "Campo", lote: "Lote", kgs: "Kgs Neto", ctg: "NRO CTG", cpe: "CPE",
  patente: "Patente", fecha: "Fecha", transportista: "Transportista",
};
const GRANOS = ["maiz", "soja", "girasol", "trigo", "sorgo", "cebada"];

const ExcelJS = () => globalThis.ExcelJS;

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7f]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function ctgNum(v) {
  if (v === null || v === undefined || v instanceof Date) return null;
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

// Valor "visible" de una celda de ExcelJS (fórmulas, texto enriquecido, hipervínculos)
function plano(v) {
  if (v === null || v === undefined || v instanceof Date || typeof v !== "object") return v ?? null;
  if ("result" in v) return plano(v.result);
  if (v.richText) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return v.text;
  return null;
}

const vacio = (v) => v === null || v === undefined || v === "";

async function abrir(bytes) {
  const wb = new (ExcelJS().Workbook)();
  await wb.xlsx.load(bytes);
  return wb;
}

function mapearEncabezados(ws) {
  const cols = {};
  ws.getRow(1).eachCell((celda, columna) => {
    const h = normalizar(plano(celda.value));
    if (!h) return;
    for (const [logico, opciones] of Object.entries(SINONIMOS)) {
      if (!(logico in cols) && opciones.includes(h)) {
        cols[logico] = columna;
        break;
      }
    }
  });
  return cols;
}

function ultimaFila(ws, cols) {
  const claves = ["cultivo", "campo", "kgs", "ctg", "cpe"].filter((k) => k in cols).map((k) => cols[k]);
  for (let fila = ws.rowCount; fila > 1; fila--) {
    if (claves.some((c) => !vacio(ws.getCell(fila, c).value))) return fila;
  }
  return 1;
}

function masComunes(contador) {
  return [...contador.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

function contar(mapa, clave) {
  mapa.set(clave, (mapa.get(clave) || 0) + 1);
}

export class Libro {
  constructor(hojas, indiceCtg) {
    this.hojas = hojas;          // nombre -> {nombre, columnas, ultimaFila, cultivoEtiqueta, campos, lotesPorCampo, ctgs, faltantes}
    this.indiceCtg = indiceCtg;  // ctg -> [[hoja, fila]]
  }

  duplicados(ctg) {
    const n = ctgNum(ctg);
    return (n && this.indiceCtg.get(n)) || [];
  }

  sugerirHoja(grano, ctg) {
    const g = normalizar(grano);
    const clave = GRANOS.find((k) => g.includes(k)) || g;
    const todas = Object.values(this.hojas);
    let candidatas = todas.filter((h) => clave
      && (normalizar(h.nombre).includes(clave) || normalizar(h.cultivoEtiqueta).includes(clave)));
    if (!candidatas.length) candidatas = todas;
    if (!candidatas.length) return null;
    const n = ctgNum(ctg) || 0;
    // La hoja "activa" es la que tiene más CTG cercanos (los CTG son correlativos en el tiempo)
    const puntaje = (h) => [h.ctgs.filter((x) => Math.abs(x - n) <= 2_000_000).length, Math.max(0, ...h.ctgs)];
    return candidatas.reduce((mejor, h) => {
      const [a1, a2] = puntaje(h);
      const [b1, b2] = puntaje(mejor);
      return a1 > b1 || (a1 === b1 && a2 > b2) ? h : mejor;
    }).nombre;
  }
}

export async function analizarLibro(bytes) {
  const wb = await abrir(bytes);
  const hojas = {};
  const indice = new Map();

  for (const ws of wb.worksheets) {
    const cols = mapearEncabezados(ws);
    if (!("ctg" in cols) || !("cpe" in cols)) continue;
    const ultima = ultimaFila(ws, cols);
    const cultivos = new Map();
    const campos = new Map();
    const lotes = new Map();
    const ctgs = [];
    for (let f = 2; f <= ultima; f++) {
      const n = ctgNum(plano(ws.getCell(f, cols.ctg).value));
      if (n) {
        ctgs.push(n);
        if (!indice.has(n)) indice.set(n, []);
        indice.get(n).push([ws.name, f]);
      }
      const cultivo = "cultivo" in cols ? plano(ws.getCell(f, cols.cultivo).value) : null;
      if (!vacio(cultivo)) contar(cultivos, String(cultivo).trim());
      let campo = "campo" in cols ? plano(ws.getCell(f, cols.campo).value) : null;
      if (vacio(campo)) continue;
      campo = String(campo).trim();
      contar(campos, campo);
      if ("lote" in cols) {
        const lote = plano(ws.getCell(f, cols.lote).value);
        if (!vacio(lote) && !(lote instanceof Date) && typeof lote !== "boolean") {
          if (!lotes.has(campo)) lotes.set(campo, new Map());
          contar(lotes.get(campo), String(lote));
        }
      }
    }
    hojas[ws.name] = {
      nombre: ws.name,
      columnas: cols,
      ultimaFila: ultima,
      cultivoEtiqueta: masComunes(cultivos)[0] || "",
      campos: masComunes(campos),
      lotesPorCampo: Object.fromEntries([...lotes].map(([c, cnt]) => [c, masComunes(cnt)])),
      ctgs,
      faltantes: COLUMNAS_EXTRA.filter((c) => !(c in cols)),
    };
  }
  return new Libro(hojas, indice);
}

// Devuelve el campo tal como está escrito en el Excel si coincide (sin importar mayúsculas)
export function campoCanonico(texto, conocidos) {
  const n = normalizar(texto);
  const exacto = conocidos.find((c) => normalizar(c) === n);
  if (exacto) return exacto;
  // coincidencia parcial: 'Paunero' -> 'Fortin Paunero'
  const parcial = conocidos.find((c) => n && (normalizar(c).includes(n) || n.includes(normalizar(c))));
  return parcial || String(texto || "").trim();
}

function titulo(texto) {
  return texto.toLowerCase().replace(/(^|[\s.-])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
}

// En las planillas usan el apellido ('Barbesini'). Persona física (CUIT 20/23/24/27) -> apellido.
export function transportistaCorto(nombre, cuit = "") {
  if (["20", "23", "24", "27"].includes(cuit.slice(0, 2)) && nombre) return titulo(nombre.split(/\s+/)[0]);
  return titulo(nombre || "");
}

function valorLote(lote) {
  const l = String(lote).trim();
  return /^\d+$/.test(l) ? parseInt(l, 10) : l;
}

function fechaExcel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; // ExcelJS escribe las fechas en UTC
}

const copiarEstilo = (estilo) => JSON.parse(JSON.stringify(estilo || {}));

// filas: [{hoja, cultivo, campo, lote, kgs, ctg, cpe, patente, fecha ("YYYY-MM-DD"), transportista}]
export async function guardarFilas(bytes, filas, agregarColumnasFaltantes = false) {
  const wb = await abrir(bytes);
  const escritas = [];
  const avisos = new Set();

  for (const fila of filas) {
    const ws = wb.getWorksheet(fila.hoja);
    const cols = mapearEncabezados(ws);
    if (agregarColumnasFaltantes) {
      for (const extra of COLUMNAS_EXTRA) {
        if (extra in cols) continue;
        let ultimaCol = 0;
        ws.getRow(1).eachCell((celda, columna) => { if (!vacio(plano(celda.value))) ultimaCol = Math.max(ultimaCol, columna); });
        const nueva = ultimaCol + 1;
        ws.getCell(1, nueva).value = ETIQUETAS[extra];
        ws.getCell(1, nueva).style = copiarEstilo(ws.getCell(1, Math.max(...Object.values(cols))).style);
        cols[extra] = nueva;
      }
    }
    const destino = ultimaFila(ws, cols) + 1;
    const modelo = destino > 2 ? destino - 1 : null;

    let ctgsTexto = 0;
    for (let f = 2; f < destino; f++) ctgsTexto += typeof ws.getCell(f, cols.ctg).value === "string";
    const ctgValor = ctgsTexto > (destino - 2) / 2 ? fila.ctg : ctgNum(fila.ctg);

    const valores = {
      cultivo: fila.cultivo, campo: fila.campo, lote: valorLote(fila.lote), kgs: fila.kgs, ctg: ctgValor,
      cpe: fila.cpe, patente: fila.patente || null, fecha: fechaExcel(fila.fecha),
      transportista: fila.transportista || null,
    };
    for (const [clave, valor] of Object.entries(valores)) {
      if (!(clave in cols)) {
        if (!vacio(valor) && COLUMNAS_EXTRA.includes(clave)) {
          avisos.add(`'${fila.hoja}' no tiene columna ${ETIQUETAS[clave]}: no se cargó.`);
        }
        continue;
      }
      const celda = ws.getCell(destino, cols[clave]);
      if (modelo) celda.style = copiarEstilo(ws.getCell(modelo, cols[clave]).style); // formato de la fila de arriba
      celda.value = valor;
      if (clave === "fecha" && valor) celda.numFmt = "dd/mm/yyyy";
      if (clave === "ctg" && typeof valor === "number") celda.numFmt = "0";
    }
    escritas.push([fila.hoja, destino]);
  }

  const contenido = new Uint8Array(await wb.xlsx.writeBuffer());
  return { contenido, filas: escritas, avisos: [...avisos].sort() };
}
