import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { leerCpe } from "../../pwa/js/extractor.js";

const EJEMPLO = new URL("../../ejemplos/cpe-00001-00026528.pdf", import.meta.url);

test("CPE de ejemplo", { skip: !existsSync(EJEMPLO) && "falta ejemplos/cpe-00001-00026528.pdf" }, async () => {
  const c = await leerCpe(new Uint8Array(readFileSync(EJEMPLO)), pdfjs, "ejemplo.pdf");
  assert.equal(c.nroCpe, "00001-00026528");
  assert.equal(c.ctg, "10134300029");
  assert.equal(c.fecha, "2026-08-11");
  assert.equal(c.grano, "Maíz");
  assert.equal(c.tipoGrano, "Maiz Flynt o Plata");
  assert.equal(c.campania, "2526");
  assert.deepEqual([c.pesoBruto, c.pesoTara, c.pesoNeto], [45000, 15040, 29960]);
  assert.equal(c.observaciones, "Fortin Paunero");
  assert.equal(c.patente, "HDE283");
  assert.equal(c.patenteAcoplado, "PGU661");
  assert.equal(c.transportista, "BARBESINI CLAUDIO OSCAR");
  assert.equal(c.transportistaCuit, "20237684436");
  assert.equal(c.chofer, "LOPEZ BRUNO DANILO");
  assert.equal(c.localidadOrigen, "ITALO");
  assert.equal(c.localidadDestino, "FIGHIERA");
  assert.equal(c.netoDescarga, null);
  assert.deepEqual(c.advertencias, []);
});
