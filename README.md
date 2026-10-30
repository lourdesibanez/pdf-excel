# CPE → Excel

App para el celular (iPhone y Android) que lee PDFs de **Cartas de Porte Electrónicas (ARCA)** y agrega las filas al **Excel compartido** de avance de cosecha (hojas `CPE Maiz Tard.`, `CPE Soja1`, `CPE Girasol`, etc.). Varias personas pueden cargar al mismo tiempo sin pisarse.

```
 José (iPhone)                         Juan (iPhone)
 sube PDF → completa lote              sube PDF → completa lote
        └──── "agregá esta fila" ──┐  ┌──── "agregá esta fila" ────┘
                                   ▼  ▼
                 Hoja de Google (con el script de apps-script/)
                  fila 101 ← José  ·  fila 102 ← Juan
                                   ▲
                     Vos en la PC lo ves y editás en vivo
```

- La app es una **PWA**: se instala desde Safari con su ícono. **Leer el PDF y completar los lotes funciona sin señal**, y las cartas a medio cargar quedan guardadas en el teléfono aunque se cierre la app. **Para guardar hace falta internet.**
- El Excel vive en **Google Sheets**. La app nunca reemplaza el archivo: solo le pide al script de la planilla que agregue filas al final, con un candado para que dos cargas simultáneas no se pisen.
- Antes de escribir, el script revisa si el CTG ya está cargado, también si lo cargó otra persona hace un minuto. En ese caso no escribe nada y avisa.
- Cada persona se conecta con **su propio código**, sin cuenta de Google. Si la hoja tiene una columna **Cargado por**, ahí queda anotado quién cargó cada fila.
- **Desde WhatsApp en dos toques** (opcional): con el Atajo de iPhone "Mandar a CPE" se comparte el PDF directo desde WhatsApp y aparece en la app esperando el lote. El PDF espera en el Drive del dueño de la planilla solo hasta que se carga o se descarta. Ver [apps-script/ATAJO.md](apps-script/ATAJO.md).

## Puesta en marcha

1. **Planilla:** seguí [apps-script/LEEME.md](apps-script/LEEME.md) para pasar el Excel a Google Sheets, pegar el script, publicarlo y generar un código por persona.
2. **App:** publicala una vez (ver más abajo) e instalala en cada iPhone desde **Safari → Compartir → Agregar a inicio**.
3. Cada persona abre la app, pega su código y toca **Conectar**.

## Cómo se usa

1. **Agregar PDFs de CPE**: uno o varios, desde Archivos, Mail o WhatsApp.
2. Para cada CPE la app:
   - lee N° CPE, CTG, fecha, grano, kilos netos, campo (de *Observaciones*), patente y transportista;
   - **sugiere la hoja destino** según el grano y los CTG ya cargados. Para maíz y soja la confirmás vos, porque el PDF no distingue tardío/flint ni 1ra/2da;
   - te pide **el lote y los kilos**. Si la carga se repartió, se agrega un lote por cada parte y la app controla que la suma dé el neto;
   - **avisa si el CTG ya está cargado**.
3. **Guardar en el Excel.** Las filas aparecen al instante en la hoja de Google.

Las columnas se ubican por el **nombre del encabezado** (fila 1), no por la posición: Cultivo, Campo, Lote, Kgs Neto, NRO CTG / CTG, CPE, Patente, Fecha, Transportista y, opcional, Cargado por. Si a una hoja le faltan Patente, Fecha o Transportista, la app avisa, y hay una opción para que agregue esas columnas.

## Publicar la app (una sola vez)

Tiene que estar publicada con HTTPS para que el iPhone la pueda instalar. Con **GitHub Pages** es gratis:

1. Subir esta carpeta a un repositorio de GitHub:
   ```
   git add .
   git commit -m "CPE a Excel"
   git branch -M main
   git remote add origin https://github.com/<usuario>/cpe-a-excel.git
   git push -u origin main
   ```
   Se sube solo el programa. El `.gitignore` deja afuera los `.xlsx` y la carpeta `ejemplos/`. Los códigos de conexión tampoco están en el repo: los genera la planilla. En el plan gratis de GitHub, Pages requiere que el repositorio sea **público**.
2. En GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Cada `push` a `main` corre los tests y publica la carpeta `pwa/`. La dirección queda como `https://<usuario>.github.io/cpe-a-excel/`.

Otras opciones: arrastrar la carpeta `pwa/` a **Netlify Drop** (app.netlify.com/drop) o a **Cloudflare Pages**.

**Actualizaciones:** cuando publicás una versión nueva, el teléfono la descarga en segundo plano y la usa a partir de la siguiente vez que se abre la app.

## Estructura

| Ruta | Qué hace |
|---|---|
| `apps-script/Codigo.gs` | Script de la hoja de Google: recibe las filas, controla duplicados y escribe con candado. Agrega el menú **App CPE** para crear y dar de baja códigos. También es la bandeja de los PDFs que llegan por WhatsApp. |
| `apps-script/ATAJO.md` | Cómo armar y repartir el Atajo de iPhone "Mandar a CPE". |
| `pwa/js/extractor.js` | PDF → datos. Usa pdf.js para sacar el texto, lo rearma por líneas y aplica expresiones regulares. Corre en el teléfono. |
| `pwa/js/libro.js` | Lo que la app sabe del Excel: hojas, CTG cargados, campos y lotes (para sugerir y avisar). |
| `pwa/js/api.js` | Conexión con el script (código de conexión y llamadas). |
| `pwa/js/app.js` | Pantallas: conexión, tarjetas por CPE, validaciones, guardar. |
| `pwa/js/store.js` | Guardado en el teléfono (IndexedDB): conexión, última lectura del Excel y cartas pendientes. |
| `pwa/sw.js`, `pwa/manifest.webmanifest`, `pwa/icons/` | Lo que la hace instalable y offline. |
| `pwa/vendor/` | pdf.js copiado localmente. Se regenera con `npm run vendor`. |
| `tests/js/` | Tests: extractor con el PDF real, `libro.js`, y el script de la planilla corriendo sobre una hoja simulada (`sheets-falso.mjs`). |
| `app.py`, `extractor.py`, `excel_writer.py`, `tests/*.py` | Versión anterior en Python/Streamlit, para un Excel local en una sola PC (`iniciar.bat`). |

## Desarrollo

```
npm install        # pdf.js (para tests y vendor)
npm test           # tests (el del PDF usa ejemplos/cpe-00001-00026528.pdf si existe)
npm run serve      # sirve pwa/ en http://localhost:8080
```

Si agregás archivos a la app, sumalos a `ARCHIVOS` en `pwa/sw.js` y subí el número de `CACHE`. Si cambiás `Codigo.gs`, pegalo de nuevo en Apps Script y publicá una **nueva versión** de la misma implementación (ver LEEME).

## Limitaciones conocidas

- Solo funciona con PDFs digitales de CPE de ARCA. Una CPE escaneada o fotografiada necesitaría OCR.
- Para guardar hace falta señal. Sin señal la carta queda pendiente en el teléfono hasta que se toque *Guardar* con conexión.
- Las fórmulas que suman un rango fijo (por ejemplo `D35:D49`) no se extienden solas a las filas nuevas. Conviene usar columnas completas (`D:D`).
- Al pasar el Excel a Google Sheets, algunas funciones muy específicas de Excel (macros, ciertos gráficos) pueden no convertirse igual. Revisalo la primera vez.
