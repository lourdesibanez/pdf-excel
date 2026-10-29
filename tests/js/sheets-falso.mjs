// Imitación mínima de Google Sheets / Apps Script para correr apps-script/Codigo.gs en Node.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CODIGO = new URL("../../apps-script/Codigo.gs", import.meta.url);

class Rango {
  constructor(hoja, fila, col, filas, cols) {
    Object.assign(this, { hoja, fila, col, filas, cols });
  }
  celdas() {
    const r = [];
    for (let f = 0; f < this.filas; f++) for (let c = 0; c < this.cols; c++) r.push([this.fila + f, this.col + c, f, c]);
    return r;
  }
  getValues() {
    const m = Array.from({ length: this.filas }, () => Array(this.cols).fill(""));
    for (const [f, c, i, j] of this.celdas()) m[i][j] = this.hoja.celda(f, c).v;
    return m;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) {
    const celda = this.hoja.celda(this.fila, this.col, true);
    // Como Sheets: un texto numérico se convierte en número salvo que la celda tenga formato texto
    celda.v = typeof v === "string" && celda.fmt !== "@" && /^\d+$/.test(v) ? Number(v) : v;
    return this;
  }
  setNumberFormat(fmt) {
    for (const [f, c] of this.celdas()) this.hoja.celda(f, c, true).fmt = fmt;
    return this;
  }
  getNumberFormat() { return this.hoja.celda(this.fila, this.col).fmt; }
  copyTo(destino) {
    for (const [f, c, i, j] of this.celdas()) {
      destino.hoja.celda(destino.fila + i, destino.col + j, true).fmt = this.hoja.celda(f, c).fmt;
    }
  }
}

export class HojaFalsa {
  constructor(nombre, filas = [], maxFilas = 1000) {
    this.nombre = nombre;
    this.datos = new Map();
    this.maxFilas = maxFilas;
    this.maxCols = 26;
    filas.forEach((fila, i) => fila.forEach((v, j) => { if (v !== null && v !== undefined) this.celda(i + 1, j + 1, true).v = v; }));
  }
  celda(f, c, crear = false) {
    if (f > this.maxFilas || c > this.maxCols) throw new Error(`Rango fuera de la hoja: ${f},${c}`);
    const k = `${f},${c}`;
    if (!this.datos.has(k)) {
      if (!crear) return { v: "", fmt: "General" };
      this.datos.set(k, { v: "", fmt: "General" });
    }
    return this.datos.get(k);
  }
  getName() { return this.nombre; }
  getRange(f, c, filas = 1, cols = 1) { return new Rango(this, f, c, filas, cols); }
  conValor() { return [...this.datos].filter(([, x]) => x.v !== "").map(([k]) => k.split(",").map(Number)); }
  getLastRow() { return Math.max(0, ...this.conValor().map(([f]) => f)); }
  getLastColumn() { return Math.max(0, ...this.conValor().map(([, c]) => c)); }
  getMaxRows() { return this.maxFilas; }
  getMaxColumns() { return this.maxCols; }
  insertRowsAfter(_despues, n) { this.maxFilas += n; }
  insertColumnsAfter(_despues, n) { this.maxCols += n; }
  fila(f) { return Array.from({ length: this.getLastColumn() }, (_, i) => this.celda(f, i + 1).v); }
}

export function cargarScript(hojas, { claves = {}, nombre = "Avance cosecha CA2526" } = {}) {
  const props = new Map([["CLAVES", JSON.stringify(claves)]]);
  const libro = {
    getSheets: () => hojas,
    getSheetByName: (n) => hojas.find((h) => h.nombre === n) || null,
    getName: () => nombre,
  };
  const candado = { tomado: false };
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => libro,
      flush: () => {},
      CopyPasteType: { PASTE_FORMAT: "PASTE_FORMAT" },
    },
    LockService: {
      getDocumentLock: () => ({
        tryLock: () => (candado.tomado ? false : (candado.tomado = true)),
        releaseLock: () => { candado.tomado = false; },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (texto) => ({ texto, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(CODIGO, "utf8"), ctx);
  // Igual que la web app: entra un POST con JSON y sale texto JSON
  ctx.post = (cuerpo) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).texto);
  ctx.candado = candado;
  return ctx;
}
