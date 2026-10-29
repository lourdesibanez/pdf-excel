# CPE → Excel — contexto para Claude

PWA (iPhone/Android) que lee PDFs de Cartas de Porte Electrónicas (CPE) de ARCA en el teléfono y agrega filas a un Excel **compartido en Google Sheets**. Varias personas (José, Juan) cargan a la vez: la app nunca reemplaza el archivo, le pide a un Apps Script de la planilla que agregue filas.

## Piezas
- `apps-script/Codigo.gs`: web app (ejecuta como el dueño, acceso "Cualquier persona"). `doPost` con `{accion: "libro"|"agregar", clave, ...}`. `agregar` toma `LockService.getDocumentLock()`, vuelve a buscar los CTG (rechaza todo el lote si hay duplicados no forzados) y escribe con `escribirFila_` (copia formato de la fila de arriba, CTG texto/número según la hoja, CPE como texto, "Cargado por"). Las claves por persona están en Script Properties `CLAVES` ({clave: nombre}) y se crean desde el menú `App CPE` (`onOpen`). El código de conexión es base64url de `{u: url /exec, k: clave, n: nombre}`.
- `pwa/js/extractor.js`: pdf.js → líneas (agrupa items por y con tolerancia de 3 pt, imitando pdfplumber) → regex.
- `pwa/js/libro.js`: `analizarHojas()` sobre lo que devuelve `leerHojas_` → sugerir hoja, duplicados, campos/lotes conocidos. `SINONIMOS` y la lógica de mapeo de columnas están en `Codigo.gs`: si se cambian, mantener coherencia.
- `pwa/js/api.js`: `fetch` POST con `Content-Type: text/plain` (evita el preflight CORS que Apps Script no soporta). `SinConexion` para errores de red.
- `pwa/js/app.js`: UI con un helper `h()`. Guarda en IndexedDB la conexión, la última lectura del libro (para usar sin señal) y las tarjetas pendientes.
- `pwa/sw.js`: precache + stale-while-revalidate, solo para GET del mismo origen. Si se agregan archivos: sumarlos a `ARCHIVOS` y subir `CACHE`.
- `tests/js/sheets-falso.mjs`: imitación de SpreadsheetApp/LockService/PropertiesService que corre el `Codigo.gs` real en `vm`. La usan los tests y sirve para pruebas e2e (interceptando `https://script.google.com/**`).
- Versión Python/Streamlit anterior (`app.py`, `extractor.py`, `excel_writer.py`): Excel local de una sola PC. Las reglas del dominio son las mismas.

## Reglas del dominio
- El PDF NO trae el lote: siempre lo ingresa el usuario. Una CPE puede repartirse en varios lotes (una fila por lote, mismo CTG/CPE).
- El campo de origen viene en "Observaciones" del PDF.
- Maíz (tardío vs flint) y soja (1ra vs 2da) no se distinguen en el PDF: se sugiere la hoja y el usuario confirma.
- Transportista: en las planillas se usa el apellido ("Barbesini"); para persona física (CUIT 20/23/24/27) se toma la primera palabra.
- El CTG se escribe como número o texto según lo que predomine en la hoja; el CPE siempre como texto `00001-00026528`.
- Fechas: viajan como texto ISO `YYYY-MM-DD`; el script las escribe al mediodía para que ninguna zona horaria cambie el día.

## Comandos
- Tests: `npm test` (Node ≥ 20; el test del PDF se saltea si falta `ejemplos/cpe-00001-00026528.pdf`)
- Servir local: `npm run serve` → http://localhost:8080
- Tests Python (versión vieja): `python -m pytest tests`
