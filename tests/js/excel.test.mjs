import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { analizarLibro, guardarFilas, campoCanonico, transportistaCorto } from "../../pwa/js/excel.js";

globalThis.ExcelJS = ExcelJS;

async function libroEjemplo() {
  const wb = new ExcelJS.Workbook();
  const maiz = wb.addWorksheet("CPE Maiz Tard.");
  maiz.addRow(["Cultivo", "Campo", "Lote", "Kgs Neto", "NRO CTG", "CPE", "Total"]);
  maiz.addRow(["Maiz Tardio", "Fortin Paunero", 3, 30000, 10134300001, "00001-00026500"]);
  maiz.getCell("D2").numFmt = "#,##0";
  maiz.getCell("G1").value = { formula: "SUM(D:D)", result: 30000 };
  const soja = wb.addWorksheet("CPE Soja1");
  soja.addRow(["Cultivo", "Campo", "Lote", "Kgs Neto", "CPE", "CTG", "Patente", "Fecha", "Transportista"]);
  soja.addRow(["Soja", "La Esperanza", "5", 28000, "00001-00020000", "10100000000", "AAA111", null, "Perez"]);
  wb.addWorksheet("AVANCE").addRow(["Resumen"]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const fila = (lote, kgs) => ({
  hoja: "CPE Maiz Tard.", cultivo: "Maiz Tardio", campo: "Fortin Paunero", lote, kgs, ctg: "10134300029",
  cpe: "00001-00026528", patente: "HDE283", fecha: "2026-08-11", transportista: "Barbesini",
});

test("analiza hojas, duplicados y sugerencia", async () => {
  const libro = await analizarLibro(await libroEjemplo());
  assert.deepEqual(Object.keys(libro.hojas), ["CPE Maiz Tard.", "CPE Soja1"]);
  assert.equal(libro.sugerirHoja("Maíz", "10134300029"), "CPE Maiz Tard.");
  assert.equal(libro.sugerirHoja("Soja", "10134300029"), "CPE Soja1");
  assert.deepEqual(libro.duplicados("10134300001"), [["CPE Maiz Tard.", 2]]);
  assert.deepEqual(libro.duplicados("10100000000"), [["CPE Soja1", 2]]);
  assert.deepEqual(libro.hojas["CPE Maiz Tard."].faltantes, ["patente", "fecha", "transportista"]);
  assert.deepEqual(libro.hojas["CPE Maiz Tard."].lotesPorCampo, { "Fortin Paunero": ["3"] });
});

test("guarda filas, copia formato y no toca el original", async () => {
  const original = await libroEjemplo();
  const res = await guardarFilas(original, [fila("3", 20000), fila("4", 9960)]);
  assert.deepEqual(res.filas, [["CPE Maiz Tard.", 3], ["CPE Maiz Tard.", 4]]);
  assert.equal(res.avisos.length, 3);

  const nuevo = await analizarLibro(res.contenido);
  assert.deepEqual(nuevo.duplicados("10134300029"), [["CPE Maiz Tard.", 3], ["CPE Maiz Tard.", 4]]);
  assert.deepEqual((await analizarLibro(original)).duplicados("10134300029"), []);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.contenido);
  const ws = wb.getWorksheet("CPE Maiz Tard.");
  assert.deepEqual(ws.getRow(4).values.slice(1, 7), ["Maiz Tardio", "Fortin Paunero", 4, 9960, 10134300029, "00001-00026528"]);
  assert.equal(ws.getCell("D4").numFmt, "#,##0");
  assert.equal(ws.getCell("G1").value.formula, "SUM(D:D)");
  assert.ok(wb.getWorksheet("AVANCE"));
});

test("agrega columnas faltantes y respeta CTG como texto", async () => {
  const res = await guardarFilas(await libroEjemplo(), [fila("3", 29960), { ...fila("7", 1000), hoja: "CPE Soja1" }], true);
  assert.deepEqual(res.avisos, []);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.contenido);
  const maiz = wb.getWorksheet("CPE Maiz Tard.");
  assert.deepEqual(maiz.getRow(1).values.slice(8, 11), ["Patente", "Fecha", "Transportista"]);
  assert.equal(maiz.getCell("I3").value.toISOString(), "2026-08-11T00:00:00.000Z");
  const soja = wb.getWorksheet("CPE Soja1");
  assert.equal(soja.getCell("F3").value, "10134300029");
  assert.equal(soja.getCell("C3").value, 7);
});

test("abre un Excel guardado por openpyxl (como el real)", { skip: !tienePython() && "sin Python" }, async () => {
  const bytes = execFileSync(python(), ["-c", `
import io, sys, openpyxl
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "CPE Girasol"
ws.append(["Cultivo", "Campo", "Lote", "Kgs Neto", "CTG", "CPE"])
ws.append(["Girasol", "Fortin Paunero", "2A", 25000, 10134299999, "00001-00026000"])
ws["H1"] = "=SUM(D2:D10)"
b = io.BytesIO(); wb.save(b); sys.stdout.buffer.write(b.getvalue())`]);
  const libro = await analizarLibro(new Uint8Array(bytes));
  assert.equal(libro.sugerirHoja("Girasol", "10134300029"), "CPE Girasol");
  const res = await guardarFilas(new Uint8Array(bytes), [{ ...fila("2A", 29960), hoja: "CPE Girasol" }]);
  assert.deepEqual(res.filas, [["CPE Girasol", 3]]);
});

test("campo y transportista", () => {
  assert.equal(campoCanonico("FORTIN PAUNERO", ["Fortin Paunero"]), "Fortin Paunero");
  assert.equal(campoCanonico("Paunero", ["Fortin Paunero"]), "Fortin Paunero");
  assert.equal(transportistaCorto("BARBESINI CLAUDIO OSCAR", "20237684436"), "Barbesini");
  assert.equal(transportistaCorto("WILLIAMS ENTREGAS SA", "30707386076"), "Williams Entregas Sa");
});

function python() {
  return process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
}
function tienePython() {
  try { execFileSync(python(), ["-c", "import openpyxl"]); return true; } catch { return false; }
}
