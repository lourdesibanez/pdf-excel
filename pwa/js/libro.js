// Lo que la app sabe del Excel compartido: hojas de CPE, CTG cargados, campos y lotes usados.
// Los datos vienen del script de la planilla (apps-script/Codigo.gs, función leerHojas_).

export const COLUMNAS_EXTRA = ["patente", "fecha", "transportista"];
export const ETIQUETAS = {
  cultivo: "Cultivo", campo: "Campo", lote: "Lote", kgs: "Kgs Neto", ctg: "NRO CTG", cpe: "CPE",
  patente: "Patente", fecha: "Fecha", transportista: "Transportista",
};
const GRANOS = ["maiz", "soja", "girasol", "trigo", "sorgo", "cebada"];

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7f]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function ctgNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

const vacio = (v) => v === null || v === undefined || v === "";

function contar(mapa, clave) {
  mapa.set(clave, (mapa.get(clave) || 0) + 1);
}

function masComunes(contador) {
  return [...contador.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export class Libro {
  constructor(hojas, indiceCtg) {
    this.hojas = hojas;          // nombre -> {nombre, columnas, cultivoEtiqueta, campos, lotesPorCampo, ctgs, faltantes}
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

// hojas: [{nombre, columnas, filas: [{fila, cultivo, campo, lote, ctg}]}]
export function analizarHojas(hojas) {
  const resultado = {};
  const indice = new Map();
  for (const { nombre, columnas, filas } of hojas) {
    const cultivos = new Map();
    const campos = new Map();
    const lotes = new Map();
    const ctgs = [];
    for (const f of filas) {
      const n = ctgNum(f.ctg);
      if (n) {
        ctgs.push(n);
        if (!indice.has(n)) indice.set(n, []);
        indice.get(n).push([nombre, f.fila]);
      }
      if (!vacio(f.cultivo)) contar(cultivos, String(f.cultivo).trim());
      if (vacio(f.campo)) continue;
      const campo = String(f.campo).trim();
      contar(campos, campo);
      if (!vacio(f.lote) && typeof f.lote !== "boolean") {
        if (!lotes.has(campo)) lotes.set(campo, new Map());
        contar(lotes.get(campo), String(f.lote));
      }
    }
    resultado[nombre] = {
      nombre,
      columnas,
      cultivoEtiqueta: masComunes(cultivos)[0] || "",
      campos: masComunes(campos),
      lotesPorCampo: Object.fromEntries([...lotes].map(([c, cnt]) => [c, masComunes(cnt)])),
      ctgs,
      faltantes: COLUMNAS_EXTRA.filter((c) => !(c in columnas)),
    };
  }
  return new Libro(resultado, indice);
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
