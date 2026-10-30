import { test } from "node:test";
import assert from "node:assert/strict";
import { HojaFalsa, cargarScript } from "./sheets-falso.mjs";

const CLAVES = { cJose: "José", cJuan: "Juan" };
const PDF = Buffer.from("%PDF-1.4\n% carta de porte de prueba\n%%EOF");
// Como lo manda el Atajo del iPhone: base64 con saltos de línea cada 76 caracteres
const base64Atajo = (buf) => buf.toString("base64").replace(/(.{76})/g, "$1\n");

function nuevo() {
  const maiz = new HojaFalsa("CPE Maiz Tard.", [["Cultivo", "Campo", "Lote", "Kgs Neto", "NRO CTG", "CPE"]]);
  return { maiz, gs: cargarScript([maiz], { claves: CLAVES }) };
}

const fila = { hoja: "CPE Maiz Tard.", cultivo: "Maiz", campo: "X", lote: "1", kgs: 100, ctg: "10134300029", cpe: "00001-00026528" };

test("recibir: guarda el PDF mientras espera y responde un mensaje para la notificación", () => {
  const { gs } = nuevo();
  const r = gs.post({ accion: "recibir", clave: "cJose", nombre: "cpe-00001-00026528.pdf", pdf: base64Atajo(PDF) });
  assert.equal(r.ok, true);
  assert.match(r.mensaje, /cpe-00001-00026528\.pdf recibida/);
  const [archivo] = gs.drive.pendientes();
  assert.equal(archivo.nombre, "José - cpe-00001-00026528.pdf");
  assert.deepEqual(Buffer.from(archivo.bytes.map((b) => b & 255)), PDF);
});

test("recibir: rechaza lo que no es PDF, vacío o clave inválida, siempre con mensaje", () => {
  const { gs } = nuevo();
  const noPdf = gs.post({ accion: "recibir", clave: "cJose", nombre: "foto.jpg", pdf: Buffer.from("\xff\xd8\xff").toString("base64") });
  assert.equal(noPdf.ok, false);
  assert.match(noPdf.mensaje, /no es un PDF/);
  assert.equal(gs.post({ accion: "recibir", clave: "cJose", pdf: "" }).ok, false);
  assert.match(gs.post({ accion: "recibir", clave: "otra", pdf: base64Atajo(PDF) }).mensaje, /inválido/);
  assert.equal(gs.drive.pendientes().length, 0);
});

test("pendientes: cada uno ve solo los suyos, con el PDF en base64", () => {
  const { gs } = nuevo();
  gs.post({ accion: "recibir", clave: "cJose", nombre: "a", pdf: base64Atajo(PDF) });
  gs.post({ accion: "recibir", clave: "cJuan", nombre: "b.pdf", pdf: base64Atajo(PDF) });
  const jose = gs.post({ accion: "pendientes", clave: "cJose" });
  assert.equal(jose.ok, true);
  assert.equal(jose.recibidas.length, 1);
  assert.equal(jose.recibidas[0].nombre, "a.pdf");
  assert.deepEqual(Buffer.from(jose.recibidas[0].pdf, "base64"), PDF);
  assert.ok(jose.recibidas[0].recibido);
  assert.equal(gs.post({ accion: "pendientes", clave: "cJuan" }).recibidas[0].nombre, "b.pdf");
});

test("agregar con recibidos: guarda las filas y borra el PDF", () => {
  const { gs, maiz } = nuevo();
  gs.post({ accion: "recibir", clave: "cJose", nombre: "a.pdf", pdf: base64Atajo(PDF) });
  const [rec] = gs.post({ accion: "pendientes", clave: "cJose" }).recibidas;
  const r = gs.post({ accion: "agregar", clave: "cJose", filas: [fila], recibidos: [rec.id] });
  assert.equal(r.ok, true, r.error);
  assert.equal(maiz.getLastRow(), 2);
  assert.equal(gs.drive.pendientes().length, 0);
  assert.equal(gs.drive.papelera().length, 1);
  assert.deepEqual(gs.post({ accion: "pendientes", clave: "cJose" }).recibidas, []);
});

test("agregar fallido (duplicado): el PDF sigue pendiente", () => {
  const { gs } = nuevo();
  gs.post({ accion: "agregar", clave: "cJuan", filas: [fila] });
  gs.post({ accion: "recibir", clave: "cJose", nombre: "a.pdf", pdf: base64Atajo(PDF) });
  const [rec] = gs.post({ accion: "pendientes", clave: "cJose" }).recibidas;
  assert.equal(gs.post({ accion: "agregar", clave: "cJose", filas: [fila], recibidos: [rec.id] }).ok, false);
  assert.equal(gs.drive.pendientes().length, 1);
});

test("descartar: borra el PDF y nadie puede mover PDFs ajenos", () => {
  const { gs } = nuevo();
  gs.post({ accion: "recibir", clave: "cJose", nombre: "a.pdf", pdf: base64Atajo(PDF) });
  const [rec] = gs.post({ accion: "pendientes", clave: "cJose" }).recibidas;
  const ajeno = gs.post({ accion: "descartar", clave: "cJuan", id: rec.id });
  assert.equal(ajeno.ok, false);
  assert.equal(gs.drive.pendientes().length, 1);
  assert.equal(gs.post({ accion: "descartar", clave: "cJose", id: rec.id }).ok, true);
  assert.equal(gs.drive.papelera().length, 1);
  assert.equal(gs.post({ accion: "descartar", clave: "cJose", id: "no-existe" }).ok, true);
});
