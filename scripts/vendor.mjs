// Copia pdf.js de node_modules a pwa/vendor (la app los necesita locales para funcionar offline).
// Uso: npm install && npm run vendor
import { copyFileSync, mkdirSync } from "node:fs";

const ARCHIVOS = {
  "node_modules/pdfjs-dist/legacy/build/pdf.min.mjs": "pwa/vendor/pdf.min.mjs",
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs": "pwa/vendor/pdf.worker.min.mjs",
};

mkdirSync("pwa/vendor", { recursive: true });
for (const [origen, destino] of Object.entries(ARCHIVOS)) {
  copyFileSync(origen, destino);
  console.log(`${origen} -> ${destino}`);
}
