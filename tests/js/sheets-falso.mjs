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

// Drive: carpetas y archivos en memoria
export class DriveFalso {
  constructor() {
    this.items = new Map();
    this.siguiente = 1;
  }
  nuevoId() { return `id${this.siguiente++}`; }
  carpeta(nombre, padre = null) {
    const drive = this;
    const c = {
      tipo: "carpeta", id: this.nuevoId(), nombre, padre, trashed: false,
      getId: () => c.id, getName: () => c.nombre, isTrashed: () => c.trashed, getUrl: () => `https://drive/${c.id}`,
      createFolder: (n) => drive.carpeta(n, c.id),
      createFile: (blob) => drive.archivo(blob, c.id),
      getFiles: () => {
        const lista = [...drive.items.values()].filter((x) => x.tipo === "archivo" && x.padre === c.id && !x.trashed);
        return { hasNext: () => lista.length > 0, next: () => lista.shift() };
      },
    };
    this.items.set(c.id, c);
    return c;
  }
  archivo(blob, padre) {
    const a = {
      tipo: "archivo", id: this.nuevoId(), nombre: blob.nombre, bytes: blob.bytes, padre, desc: "", trashed: false,
      getId: () => a.id, getName: () => a.nombre, getBlob: () => ({ getBytes: () => a.bytes }),
      getDescription: () => a.desc, setDescription: (d) => { a.desc = d; return a; },
      setTrashed: (t) => { a.trashed = t; return a; },
    };
    this.items.set(a.id, a);
    return a;
  }
  buscar(id, tipo) {
    const x = this.items.get(id);
    if (!x || x.tipo !== tipo) throw new Error(`No existe ${id}`);
    return x;
  }
  pendientes() { // archivos que esperan (fuera de la papelera)
    return [...this.items.values()].filter((x) => x.tipo === "archivo" && !x.trashed);
  }
  papelera() {
    return [...this.items.values()].filter((x) => x.tipo === "archivo" && x.trashed);
  }
}

// Bytes como los maneja Apps Script: enteros con signo (-128..127)
const conSigno = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));

export function cargarScript(hojas, { claves = {}, nombre = "Avance cosecha CA2526", drive = new DriveFalso() } = {}) {
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
    DriveApp: {
      createFolder: (n) => drive.carpeta(n),
      getFolderById: (id) => drive.buscar(id, "carpeta"),
      getFileById: (id) => drive.buscar(id, "archivo"),
    },
    Utilities: {
      Charset: { UTF_8: "UTF-8" },
      base64Decode: (s) => {
        if (!/^[A-Za-z0-9+/]*=*$/.test(s)) throw new Error("base64 inválido");
        return conSigno(Buffer.from(s, "base64"));
      },
      base64Encode: (x) => Buffer.from(typeof x === "string" ? x : x.map((b) => b & 255)).toString("base64"),
      newBlob: (bytes, _tipo, nombreArchivo) => ({ bytes, nombre: nombreArchivo }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(CODIGO, "utf8"), ctx);
  // Igual que la web app: entra un POST con JSON y sale texto JSON
  ctx.post = (cuerpo) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).texto);
  ctx.candado = candado;
  ctx.drive = drive;
  return ctx;
}
