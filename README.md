# CPE → Excel

App para el celular (iPhone y Android) que lee PDFs de **Cartas de Porte Electrónicas (ARCA)** y las agrega al Excel de avance de cosecha (hojas `CPE Maiz Tard.`, `CPE Soja1`, `CPE Girasol`, etc.).

Es una **PWA**: se instala desde el navegador como si fuera una app, con su ícono, y **funciona sin internet**. El PDF y el Excel se procesan dentro del teléfono y nunca salen de ahí. Lo único publicado en internet es el programa, igual que una app de una tienda.

## Cómo se usa

1. **Elegir el Excel** de avance de cosecha (.xlsx), una sola vez. Queda guardado en el teléfono como "Excel de trabajo".
2. **Agregar PDFs de CPE**: uno o varios, desde Archivos, Mail, WhatsApp o donde estén.
3. Para cada CPE la app:
   - lee N° CPE, CTG, fecha, grano, kilos netos, campo (de *Observaciones*), patente y transportista;
   - **sugiere la hoja destino** según el grano y los CTG ya cargados. Para maíz y soja la confirmás vos, porque el PDF no distingue tardío/flint ni 1ra/2da;
   - te pide **el lote y los kilos**. Si la carga se repartió, se agrega un lote por cada parte y la app controla que la suma dé el neto;
   - **avisa si el CTG ya está cargado** en cualquier hoja.
4. **Agregar al Excel**: suma las filas al final de cada hoja, copiando el formato de la fila de arriba.
5. **Exportar**: en el iPhone abre el menú Compartir, desde donde podés *Guardar en Archivos*, mandarlo por WhatsApp o Mail, etc. Tu archivo original no se modifica: lo que exportás es una copia actualizada.

> Si actualizaste el Excel en la compu, en la app usá **Cambiar Excel** para cargar la versión nueva. Si no, vas a seguir agregando sobre la copia vieja que quedó en el teléfono.

Las columnas se ubican por el **nombre del encabezado** (fila 1), no por la posición: Cultivo, Campo, Lote, Kgs Neto, NRO CTG / CTG, CPE, Patente, Fecha, Transportista. Si una hoja no tiene alguna de las últimas tres, la app avisa, y hay una opción para que agregue esas columnas.

## Publicarla (una sola vez)

Necesita estar publicada con HTTPS para que el iPhone la pueda instalar. Con **GitHub Pages** es gratis:

1. Crear un repositorio en GitHub y subir esta carpeta:
   ```
   git add .
   git commit -m "CPE a Excel"
   git branch -M main
   git remote add origin https://github.com/<usuario>/cpe-a-excel.git
   git push -u origin main
   ```
   El `.gitignore` deja afuera los `.xlsx` y la carpeta `ejemplos/`, así que no se suben datos reales. Igual revisá con `git status` antes del primer push: en el plan gratis de GitHub, Pages requiere que el repositorio sea **público**.
2. En GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Cada `push` a `main` corre los tests y publica la carpeta `pwa/`. La dirección queda como `https://<usuario>.github.io/cpe-a-excel/`.

Otras opciones sin GitHub: arrastrar la carpeta `pwa/` a **Netlify Drop** (app.netlify.com/drop) o a **Cloudflare Pages**.

## Instalarla en el iPhone

1. Abrir la dirección en **Safari** (tiene que ser Safari).
2. Tocar **Compartir** → **Agregar a inicio**.
3. Abrirla una vez con internet para que quede guardada. Desde ahí funciona offline.

En Android, Chrome ofrece **Instalar app** desde el menú.

**Actualizaciones:** cuando publicás una versión nueva, el teléfono la descarga en segundo plano y la usa a partir de la siguiente vez que abrís la app.

## Estructura

| Ruta | Qué hace |
|---|---|
| `pwa/index.html`, `pwa/css/app.css` | La interfaz (pensada para celular, con modo oscuro). |
| `pwa/js/extractor.js` | PDF → datos. Usa pdf.js para sacar el texto, lo rearma por líneas y aplica expresiones regulares. |
| `pwa/js/excel.js` | Analiza el Excel (hojas de CPE, columnas, CTG cargados, lotes por campo) y agrega las filas con ExcelJS. |
| `pwa/js/app.js` | La lógica de pantalla: tarjetas por CPE, validaciones, agregar y exportar. |
| `pwa/js/store.js` | Guarda el Excel de trabajo en el teléfono (IndexedDB). |
| `pwa/sw.js`, `pwa/manifest.webmanifest`, `pwa/icons/` | Lo que la hace instalable y offline. |
| `pwa/vendor/` | pdf.js y ExcelJS copiados localmente (para que anden sin internet). Se regeneran con `npm run vendor`. |
| `tests/js/` | Tests de la PWA: `npm test` |
| `app.py`, `extractor.py`, `excel_writer.py`, `tests/*.py` | Versión anterior en Python/Streamlit, para usar en la compu (`iniciar.bat`). |

## Desarrollo

```
npm install        # librerías para tests y vendor
npm test           # tests (usa ejemplos/cpe-00001-00026528.pdf si existe)
npm run serve      # sirve pwa/ en http://localhost:8080
npm run vendor     # vuelve a copiar pdf.js y ExcelJS a pwa/vendor
```

Si cambiás la lista de archivos de la app, actualizá `ARCHIVOS` en `pwa/sw.js` y subí el número de `CACHE`.

## Limitaciones conocidas

- Solo funciona con PDFs digitales de CPE de ARCA. Una CPE escaneada o fotografiada necesitaría OCR.
- ExcelJS conserva valores, fórmulas, formatos y el resto de las hojas, pero **no conserva gráficos, tablas dinámicas ni algunos formatos condicionales**. El archivo original queda intacto, porque lo que se exporta es una copia.
- Las fórmulas que suman un rango fijo (por ejemplo `D35:D49`) no se extienden solas a las filas nuevas.
- En el iPhone, Safari puede borrar los datos de una web que no se usa por varias semanas. Instalada en el inicio, es mucho menos probable. Igual, el Excel bueno es siempre el que exportás.
