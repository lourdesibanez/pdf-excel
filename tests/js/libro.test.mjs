import { test } from "node:test";
import assert from "node:assert/strict";
import { analizarHojas, campoCanonico, transportistaNombre } from "../../pwa/js/libro.js";
import { leerCodigo } from "../../pwa/js/api.js";
import { HojaFalsa, cargarScript } from "./sheets-falso.mjs";

// Los datos salen del script real, igual que en producción
function hojasDelScript() {
  const maiz = new HojaFalsa("CPE Maiz Tard.", [
    ["Cultivo", "Campo", "Lote", "Kgs Neto", "NRO CTG", "CPE"],
    ["Maiz Tardio", "Fortin Paunero", 3, 30000, 10134300001, "00001-00026500"],
    ["Maiz Tardio", "Fortin Paunero", 3, 1000, 10134300002, "00001-00026501"],
    ["Maiz Tardio", "Fortin Paunero", "5B", 2000, 10134300003, "00001-00026502"],
  ]);
  const soja = new HojaFalsa("CPE Soja1", [
    ["Cultivo", "Campo", "Lote", "Kgs Neto", "CPE", "CTG", "Patente", "Fecha", "Transportista"],
    ["Soja", "La Esperanza", "5", 28000, "00001-00020000", "10100000000", "AAA111", "", "Perez"],
  ]);
  const gs = cargarScript([maiz, soja], { claves: { k: "José" } });
  return gs.post({ accion: "libro", clave: "k" }).hojas;
}

test("analiza hojas, duplicados, lotes y sugerencia", () => {
  const libro = analizarHojas(hojasDelScript());
  assert.deepEqual(Object.keys(libro.hojas), ["CPE Maiz Tard.", "CPE Soja1"]);
  assert.equal(libro.sugerirHoja("Maíz", "10134300029"), "CPE Maiz Tard.");
  assert.equal(libro.sugerirHoja("Soja", "10134300029"), "CPE Soja1");
  assert.equal(libro.sugerirHoja("Girasol", "10134300029"), "CPE Maiz Tard."); // sin hoja de girasol: la más activa
  assert.deepEqual(libro.duplicados("10134300001"), [["CPE Maiz Tard.", 2]]);
  assert.deepEqual(libro.duplicados("10100000000"), [["CPE Soja1", 2]]);
  assert.deepEqual(libro.duplicados(""), []);
  assert.deepEqual(libro.hojas["CPE Maiz Tard."].faltantes, ["patente", "fecha", "transportista"]);
  assert.deepEqual(libro.hojas["CPE Soja1"].faltantes, []);
  assert.deepEqual(libro.hojas["CPE Maiz Tard."].lotesPorCampo, { "Fortin Paunero": ["3", "5B"] });
  assert.equal(libro.hojas["CPE Maiz Tard."].cultivoEtiqueta, "Maiz Tardio");
});

test("campo y transportista", () => {
  assert.equal(campoCanonico("FORTIN PAUNERO", ["Fortin Paunero"]), "Fortin Paunero");
  assert.equal(campoCanonico("Paunero", ["Fortin Paunero"]), "Fortin Paunero");
  assert.equal(campoCanonico("Otro campo ", ["Fortin Paunero"]), "Otro campo");
  assert.equal(transportistaNombre("BARBESINI CLAUDIO OSCAR"), "Barbesini Claudio Oscar");
  assert.equal(transportistaNombre("WILLIAMS  ENTREGAS SA "), "Williams Entregas Sa");
  assert.equal(transportistaNombre(""), "");
});

test("código de conexión: acepta el código o el link, con tildes", () => {
  const datos = { u: "https://script.google.com/macros/s/ABC/exec", k: "clave123", n: "José" };
  const codigo = Buffer.from(JSON.stringify(datos)).toString("base64url");
  const esperado = { url: datos.u, clave: "clave123", nombre: "José" };
  assert.deepEqual(leerCodigo(codigo), esperado);
  assert.deepEqual(leerCodigo(`  ${codigo}==\n`), esperado);
  assert.deepEqual(leerCodigo(`https://x.github.io/cpe/#conectar=${codigo}`), esperado);
  // Formato nuevo (base64 estándar, el que genera la planilla y lee el Atajo), con "+", "/" y "="
  const estandar = Buffer.from(JSON.stringify({ ...datos, k: "a>b?c~" })).toString("base64");
  assert.match(estandar, /[+/=]/);
  assert.equal(leerCodigo(estandar).clave, "a>b?c~");
  assert.equal(leerCodigo(`https://x.github.io/cpe/#conectar=${encodeURIComponent(estandar)}`).clave, "a>b?c~");
  assert.throws(() => leerCodigo("cualquier cosa"), /no es válido/);
});
