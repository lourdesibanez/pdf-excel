import { test } from "node:test";
import assert from "node:assert/strict";
import { HojaFalsa, cargarScript } from "./sheets-falso.mjs";

const CLAVES = { claveJose: "José", claveJuan: "Juan" };

function planilla() {
  const maiz = new HojaFalsa("CPE Maiz Tard.", [
    ["Cultivo", "Campo", "Lote", "Kgs Neto", "NRO CTG", "CPE", "Cargado por"],
    ["Maiz Tardio", "Fortin Paunero", 3, 30000, 10134300001, "00001-00026500"],
    ["Maiz Tardio", "Fortin Paunero", 5, 28000, 10134300002, "00001-00026501"],
  ]);
  maiz.celda(3, 4).fmt = "#,##0";
  maiz.celda(1, 9, true).v = "=SUM(D:D)"; // otra cosa en la fila 1 que no es encabezado de CPE
  const soja = new HojaFalsa("CPE Soja1", [
    ["Cultivo", "Campo", "Lote", "Kgs Neto", "CPE", "CTG"],
    ["Soja", "La Esperanza", "5", 28000, "00001-00020000", "10100000000"],
  ]);
  soja.celda(2, 6).fmt = "@";
  const avance = new HojaFalsa("AVANCE", [["Resumen"]]);
  return { maiz, soja, avance, hojas: [maiz, soja, avance] };
}

const fila = (lote, kgs, extra = {}) => ({
  hoja: "CPE Maiz Tard.", cultivo: "Maiz Tardio", campo: "Fortin Paunero", lote, kgs, ctg: "10134300029",
  cpe: "00001-00026528", patente: "HDE283", fecha: "2026-08-11", transportista: "Barbesini", ...extra,
});

test("rechaza claves inválidas", () => {
  const gs = cargarScript(planilla().hojas, { claves: CLAVES });
  assert.equal(gs.post({ accion: "libro", clave: "otra" }).ok, false);
  assert.equal(gs.post({ accion: "libro" }).ok, false);
});

test("libro: devuelve solo hojas de CPE con sus filas", () => {
  const gs = cargarScript(planilla().hojas, { claves: CLAVES });
  const r = gs.post({ accion: "libro", clave: "claveJose" });
  assert.equal(r.ok, true);
  assert.equal(r.usuario, "José");
  assert.equal(r.archivo, "Avance cosecha CA2526");
  assert.deepEqual(r.hojas.map((h) => h.nombre), ["CPE Maiz Tard.", "CPE Soja1"]);
  assert.deepEqual(r.hojas[0].filas[1], { fila: 3, cultivo: "Maiz Tardio", campo: "Fortin Paunero", lote: 5, ctg: 10134300002 });
  assert.equal(r.hojas[0].columnas.usuario, 7);
});

test("agregar: escribe al final, copia formato y anota quién cargó", () => {
  const { maiz, hojas } = planilla();
  const gs = cargarScript(hojas, { claves: CLAVES });
  const r = gs.post({ accion: "agregar", clave: "claveJose", filas: [fila("3", 20000), fila("4", 9960)] });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.filas, [["CPE Maiz Tard.", 4], ["CPE Maiz Tard.", 5]]);
  assert.equal(r.avisos.length, 3); // la hoja no tiene Patente/Fecha/Transportista
  assert.deepEqual(maiz.fila(5).slice(0, 7), ["Maiz Tardio", "Fortin Paunero", 4, 9960, 10134300029, "00001-00026528", "José"]);
  assert.equal(maiz.celda(5, 4).fmt, "#,##0");
  assert.equal(maiz.celda(5, 5).fmt, "0");
  assert.equal(maiz.celda(5, 6).fmt, "@");
  assert.equal(maiz.celda(1, 9).v, "=SUM(D:D)");
  assert.equal(r.hojas[0].filas.length, 4); // devuelve el libro actualizado
});

test("dos personas seguidas: la segunda queda debajo, no pisa", () => {
  const { maiz, hojas } = planilla();
  const gs = cargarScript(hojas, { claves: CLAVES });
  assert.equal(gs.post({ accion: "agregar", clave: "claveJose", filas: [fila("3", 29960)] }).ok, true);
  const r = gs.post({ accion: "agregar", clave: "claveJuan", filas: [fila("8", 31000, { ctg: "10134300030", cpe: "00001-00026529" })] });
  assert.deepEqual(r.filas, [["CPE Maiz Tard.", 5]]);
  assert.equal(maiz.celda(4, 7).v, "José");
  assert.equal(maiz.celda(5, 7).v, "Juan");
  assert.equal(gs.candado.tomado, false);
});

test("CTG ya cargado: no escribe nada salvo que se fuerce", () => {
  const { maiz, hojas } = planilla();
  const gs = cargarScript(hojas, { claves: CLAVES });
  gs.post({ accion: "agregar", clave: "claveJose", filas: [fila("3", 29960)] });
  const antes = maiz.getLastRow();
  const r = gs.post({ accion: "agregar", clave: "claveJuan", filas: [fila("3", 29960), fila("9", 1, { ctg: "10134300099" })] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.duplicados, { 10134300029: [["CPE Maiz Tard.", 4]] });
  assert.equal(maiz.getLastRow(), antes);
  const forzado = gs.post({ accion: "agregar", clave: "claveJuan", filas: [fila("3", 29960)], forzar: ["10134300029"] });
  assert.equal(forzado.ok, true);
});

test("CTG como texto si la hoja lo usa así, columnas nuevas y fecha", () => {
  const { soja, maiz, hojas } = planilla();
  const gs = cargarScript(hojas, { claves: CLAVES });
  const r = gs.post({
    accion: "agregar", clave: "claveJose", agregarColumnas: true,
    filas: [fila("7", 1000, { hoja: "CPE Soja1", lote: "2A" }), fila("3", 29960, { ctg: "10134300031" })],
  });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(soja.fila(1).slice(6, 9), ["Patente", "Fecha", "Transportista"]);
  assert.equal(soja.celda(3, 6).v, "10134300029");
  assert.equal(soja.celda(3, 3).v, "2A");
  const fecha = soja.celda(3, 8).v;
  assert.deepEqual([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()], [2026, 7, 11]);
  assert.equal(soja.celda(3, 8).fmt, "dd/mm/yyyy");
  assert.equal(maiz.celda(1, 10).v, "Patente"); // después de la última columna con encabezado (I)
});

test("hoja llena: agrega filas al final de la grilla", () => {
  const maiz = new HojaFalsa("CPE Maiz", [["Cultivo", "Campo", "Lote", "Kgs", "CTG", "CPE"], ["Maiz", "X", 1, 1, 10134300001, "a"]], 2);
  const gs = cargarScript([maiz], { claves: CLAVES });
  const r = gs.post({ accion: "agregar", clave: "claveJose", filas: [fila("1", 5, { hoja: "CPE Maiz" })] });
  assert.deepEqual(r.filas, [["CPE Maiz", 3]]);
});

test("hoja inexistente: error claro y sin escribir", () => {
  const { maiz, hojas } = planilla();
  const gs = cargarScript(hojas, { claves: CLAVES });
  const r = gs.post({ accion: "agregar", clave: "claveJose", filas: [fila("3", 1), fila("3", 1, { hoja: "Borrada", ctg: "1" })] });
  assert.equal(r.ok, false);
  assert.match(r.error, /Borrada/);
  assert.equal(maiz.getLastRow(), 3);
});
