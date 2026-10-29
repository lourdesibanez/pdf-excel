# Preparar el Excel compartido (una sola vez)

Esto lo hace quien administra la planilla, desde la computadora. Tarda unos 10 minutos.

## 1. Pasar el Excel a Google Sheets

1. Subí `Avance cosecha CA2526.xlsx` a tu Google Drive.
2. Abrilo y andá a **Archivo → Guardar como Hojas de cálculo de Google**. Tiene que ser una hoja de Google: el script no funciona sobre un `.xlsx` abierto en modo compatibilidad.
3. Revisá que estén las hojas de CPE (`CPE Maiz Tard.`, `CPE Soja1`, etc.) con sus encabezados en la fila 1.
4. *(Opcional)* Agregá en cada hoja de CPE una columna con el encabezado **Cargado por**. La app anota ahí quién cargó cada fila.

Desde ahora, esta hoja de Google es "el Excel". Lo ves y editás desde el navegador, aunque José y Juan estén cargando al mismo tiempo. Si necesitás un `.xlsx`, usá **Archivo → Descargar → Microsoft Excel**.

## 2. Pegar el script

1. En la hoja: **Extensiones → Apps Script**.
2. Borrá lo que aparece en `Código.gs` y pegá todo el contenido de [`Codigo.gs`](Codigo.gs).
3. Tocá **Guardar** (el ícono del disquete).

## 3. Publicarlo como aplicación web

1. En Apps Script: **Implementar → Nueva implementación**.
2. En el engranaje de "Seleccionar tipo", elegí **Aplicación web**.
3. Completá:
   - **Ejecutar como:** *Yo* (tu cuenta). Así José y Juan no necesitan cuenta de Google ni acceso al archivo.
   - **Quién tiene acceso:** *Cualquier persona*. Sin una clave válida el script no hace nada, y cada persona tiene la suya.
4. **Implementar**. Google te pide autorizar: elegí tu cuenta → *Configuración avanzada* → *Ir a … (no seguro)* → **Permitir**. El aviso aparece porque el script es tuyo y no está publicado en una tienda.
5. Copiá la **URL de la aplicación web**, la que termina en `/exec`.

## 4. Crear los códigos para cada persona

1. Volvé a la hoja y recargá la página. Aparece el menú **App CPE**.
2. **App CPE → 1. Configurar**: pegá la URL `/exec` y, si querés, la dirección de la app (por ejemplo `https://usuario.github.io/cpe-a-excel/`).
3. **App CPE → 2. Crear código para una persona**: escribí "José" y mandale el código que aparece, por ejemplo por WhatsApp. Repetí para Juan.
4. Cada uno instala la app en el iPhone (Safari → Compartir → Agregar a inicio), la abre, pega su código y toca **Conectar**.

Si alguien pierde el celular o deja de cargar: **App CPE → Ver o dar de baja personas**.

## Si cambiás el script más adelante

**Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión → Implementar.** Así se mantiene la misma URL y no hay que volver a mandar los códigos. Si en cambio hacés una *nueva implementación*, la URL cambia y hay que generar códigos nuevos.

## Cómo funciona por dentro

- La app nunca reemplaza el archivo: le pide al script "agregá estas filas" y el script las escribe al final de la hoja.
- Un candado (`LockService`) hace que, si José y Juan guardan en el mismo segundo, una carga espere a la otra y queden en filas distintas.
- Con el candado tomado, el script vuelve a buscar el CTG en todas las hojas de CPE. Si ya está, no escribe nada y la app avisa "ya cargado", salvo que la persona marque *Cargarla igual*.
- Cada fila nueva copia el formato de la fila de arriba. El CTG se escribe como número o como texto según cómo esté en esa hoja, y el CPE siempre como texto.
