# CPE → Excel — contexto para Claude

PWA offline (iPhone/Android) que lee PDFs de Cartas de Porte Electrónicas (CPE) de ARCA y agrega filas al Excel de avance de cosecha (`Avance cosecha CA2526.xlsx`). Todo corre en el navegador: los archivos nunca salen del teléfono. Se publica `pwa/` en GitHub Pages (`.github/workflows/pages.yml`).

## Archivos (PWA, JS vanilla sin build)
- `pwa/js/extractor.js`: PDF → objeto CPE. pdf.js da items con coordenadas; `textoDesdeItems` los agrupa en líneas (tolerancia 3 pt en y) para imitar `pdfplumber.extract_text`, y después regex. Sin OCR ni IA.
- `pwa/js/excel.js`: `analizarLibro()` detecta hojas de CPE (encabezados CTG y CPE en fila 1), mapea columnas por nombre (`SINONIMOS`), indexa CTG para duplicados, `sugerirHoja()`; `guardarFilas()` recibe y devuelve bytes y copia el estilo de la fila de arriba. Usa `globalThis.ExcelJS` (script clásico en index.html; en tests se asigna a mano).
- `pwa/js/app.js`: UI con un helper `h()` para el DOM. Estado en memoria + Excel de trabajo en IndexedDB (`store.js`). Exporta con `navigator.share` en táctil y descarga como respaldo.
- `pwa/sw.js`: precache + stale-while-revalidate. Si se agregan archivos: sumarlos a `ARCHIVOS` y subir `CACHE`.
- `pwa/vendor/`: pdf.js (build legacy, para iOS viejos) y ExcelJS, copiados con `npm run vendor`. Se commitean.
- Versión Python/Streamlit anterior (`app.py`, `extractor.py`, `excel_writer.py`): misma lógica, para uso en PC. Si se cambia una regla del dominio, cambiarla en los dos lados.

## Reglas del dominio
- El PDF NO trae el lote: siempre lo ingresa el usuario. Una CPE puede repartirse en varios lotes (una fila por lote, mismo CTG/CPE).
- El campo de origen viene en "Observaciones" del PDF.
- Maíz (tardío vs flint) y soja (1ra vs 2da) no se distinguen en el PDF: se sugiere la hoja y el usuario confirma.
- Transportista: en las planillas se usa el apellido ("Barbesini"); para persona física (CUIT 20/23/24/27) se toma la primera palabra.
- El CTG se escribe como número o texto según lo que predomine en la hoja; el CPE siempre como texto `00001-00026528`.
- Fechas: viajan como texto ISO `YYYY-MM-DD` y se escriben como fecha UTC (ExcelJS asume UTC).

## Comandos
- Tests PWA: `npm test` (Node ≥ 20; el test del PDF se saltea si falta `ejemplos/cpe-00001-00026528.pdf`)
- Servir local: `npm run serve` → http://localhost:8080
- Tests Python: `python -m pytest tests`
