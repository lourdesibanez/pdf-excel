# Atajo "Mandar a APP-CPE": del WhatsApp a la app en dos toques

Con este atajo, en WhatsApp tocás el PDF de la carta de porte → **Compartir** → **Mandar a APP-CPE**, y listo. La carta aparece en la app CPE esperando que completes el lote y los kilos. No hace falta guardarla en Archivos.

El PDF espera en el Drive del dueño de la planilla, en la carpeta "CPE pendientes (App CPE)", **solo hasta que se carga o se descarta**. En ese momento se manda a la papelera de Drive, que Google vacía sola a los 30 días.

> **¿Es obligatorio?** No. Sin el atajo, en WhatsApp: abrir el PDF → **Compartir** → **Guardar en Archivos**, y después en la app CPE → **Agregar PDFs**. El atajo solo ahorra esos pasos. Hace falta porque el iPhone no deja que una app web aparezca en el menú Compartir.

---

## Parte 1: activar la recepción en la planilla (una vez, desde la compu)

1. En la planilla: **Extensiones → Apps Script**. Borrá todo, pegá el contenido de [`Codigo.gs`](Codigo.gs) y guardá (ícono del disquete).
2. **Implementar → Administrar implementaciones → lápiz ✏️ → Versión: Nueva versión → Implementar.** La URL no cambia.
3. Volvé a la planilla y recargá la página. Andá a **App CPE → 3. Activar recepción por WhatsApp**. Google pide permiso para usar Drive: aceptá igual que la primera vez.
4. **App CPE → 2. Crear código para una persona.** Generá un código nuevo para cada uno: vos, José y Juan.
   - El código nuevo sirve para la app **y** para el atajo.
   - Los códigos viejos siguen andando en la app, pero no en el atajo.
   - **La app y el atajo de cada persona tienen que usar el código de esa misma persona.** La app solo muestra los PDFs que mandó esa persona.

---

## Parte 2: armar el atajo (una vez, en tu iPhone)

### Cómo funciona el editor de Atajos (leelo antes de empezar)

- **Agregar una acción:** abajo de todo está la barra **Buscar acciones**. Escribís el nombre y tocás la acción.
- **Las acciones nuevas caen siempre al final.** Si tienen que ir en otro lugar, **mantenelas apretadas y arrastralas**.
- **Palabras en azul:** son los campos que se pueden tocar. En azul clarito, apagado, es texto de ejemplo: el campo está vacío.
- **Cambiar una variable que el iPhone puso solo:**
  1. Tocá la palabra azul. Se abre un menú con datos de la variable: *Nombre de variable*, *Tipo*, *Revelar acción* y una lista con Tamaño del archivo, Extensión, etc.
  2. Bajá hasta el final de ese menú y tocá **Borrar**.
  3. Tocá de nuevo el campo, que ahora quedó vacío → **Seleccionar variable**.
  4. La pantalla cambia y abajo de cada acción aparece su resultado como una **píldora de color**. Tocá la píldora que corresponde.
- **Verificar a qué apunta una variable:** tocala → **Revelar acción**. Se resalta la acción de la que sale.
- **Opciones de una acción:** muchas tienen una flechita **›** o **⌄** al final. Tocala para abrir las opciones: método, saltos de línea, etc.

### Si no tenés la app Atajos

Es gratis y de Apple. En la **App Store** buscá **"Atajos"** (ícono azul y rosa con dos cuadrados; desarrollador: Apple) → **Obtener**. Antes de bajarla, fijate si está escondida: deslizá hacia abajo en la pantalla de inicio y escribí "Atajos".

### Paso 1: crear el atajo

1. Abrí **Atajos** → **+** (arriba a la derecha).
2. Tocá el nombre de arriba (con la flechita ⌄) → **Renombrar** → escribí **Mandar a APP-CPE**.

### Paso 2: que aparezca en el menú Compartir

1. Bajá el panel de "Buscar acciones" deslizándolo hacia abajo. Abajo de todo queda la barra **↶ ↷ ⓘ ⬆︎ ▶**.
2. Tocá **ⓘ** → activá **Mostrar en hoja de compartir** → **OK**.
3. Arriba de todo aparece un bloque: **Recibir [Apps y 18 más] de [Ningún lado]** (o "Cualquier tipo de entrada").
   - Tocá **Ningún lado** → elegí **Hoja de compartir**.
   - Tocá **Apps y 18 más** → **Deseleccionar todo** → marcá solo **PDF**. Si no aparece, marcá **Archivos**.
   - "Si no hay entrada: Continuar" se deja como está.

> Si no encontrás la ⓘ, hacé primero el paso 6. Al elegir *Entrada de atajo* en el Repetir, el bloque "Recibir…" aparece solo y lo configurás igual.

### Paso 3: Texto (tu código)

1. Buscá **Texto** y agregalo.
2. Tocá adentro del bloque, donde dice "Texto", y **pegá tu código de conexión** (el nuevo, de la Parte 1).

### Paso 4: Decodificar el código

1. Buscá **base64** → **Codificar con base64**.
2. Tocá la palabra azul **Codificar** y cambiala a **Decodificar**.
3. Tiene que quedar: **Decodificar [Texto] con base64**.

### Paso 5: Obtener diccionario

1. Buscá **diccionario** → **Obtener diccionario de entrada**.
2. Tiene que quedar: **Obtener diccionario de [Codificado con Base64]**. Ese es el resultado del paso 4: el iPhone lo llama así aunque haya decodificado. Está bien.

### Paso 6: Repetir con cada archivo

1. Buscá **Repetir con cada** → **Repetir con cada elemento**.
2. Aparece un bloque doble:
   ```
   Repetir con todos los elementos de [Diccionario]
   Terminar repetición
   ```
3. El iPhone puso *Diccionario* solo, pero **tiene que ser Entrada de atajo**: tocá **Diccionario** → **Borrar** → tocá el campo vacío → elegí **Entrada de atajo**.
4. Tiene que quedar:
   ```
   Repetir con todos los elementos de [Entrada de atajo]
   Terminar repetición
   ```

**Todo lo que sigue (pasos 7 a 12) va ADENTRO del Repetir**, entre "Repetir con todos los elementos…" y "Terminar repetición". Después de agregar cada acción, arrastrala hasta ahí. Se nota que está adentro porque queda corrida a la derecha.

### Paso 7: Codificar el PDF

1. Buscá **base64** → **Codificar con base64**. Arrastrala adentro del Repetir.
2. Tiene que decir **Codificar [Repetir elemento] con base64**. Si dice otra cosa: tocala → Borrar → Seleccionar variable → píldora **Repetir elemento**, la que está abajo de "Repetir con todos los elementos…".
3. Tocá la flechita **⌄** de la acción → **Saltos de línea: Ninguno**.

### Paso 8: Sacar la dirección del script (clave `u`)

1. Buscá **valor del diccionario** → **Obtener valor del diccionario**. Arrastrala abajo del paso 7.
2. Se ve así: *Obtener [Valor] de [Clave] en [Diccionario]*.
3. Tocá **Clave** y escribí `u` (minúscula).
4. Lo último seguramente dice *Codificado con Base64*, y está mal. Tocalo → **Borrar** → tocá el campo vacío → **Seleccionar variable** → tocá la píldora naranja **Diccionario** que está **arriba del Repetir**, abajo de "Obtener diccionario de…".
5. Tiene que quedar: **Obtener Valor de u en Diccionario**.

### Paso 9: Sacar tu clave (clave `k`)

Igual que el paso 8, pero con clave `k`:

1. Agregá otra **Obtener valor del diccionario** y arrastrala abajo de la de `u`.
2. **Clave:** `k`.
3. Diccionario: Borrar → Seleccionar variable → la misma píldora **Diccionario** de arriba del Repetir.
4. Tiene que quedar: **Obtener Valor de k en Diccionario**.

### Paso 10: Mandar el PDF a la planilla

1. Buscá **contenido de URL** → **Obtener contenido de URL**. Arrastrala abajo de la de `k`.
2. Tocá **URL** → **Seleccionar variable** → tocá la píldora **Valor del diccionario** que está **abajo de la acción de `u`** (paso 8).
   ⚠️ Hay dos píldoras con el mismo nombre: la de `u` y la de `k`. **La URL es la de `u`.** Si no ves la de arriba, deslizá la pantalla hacia arriba mientras elegís.
3. Tocá la flechita **›** de la acción para abrir las opciones:
   - **Método:** tocá *GET* → **POST**.
   - **Solicitar cuerpo:** **JSON**.
4. Tocá **Agregar nuevo campo** → **Texto**, 4 veces, y completá:

   | Clave (izquierda) | Valor (derecha) |
   |---|---|
   | `accion` | escribí `recibir` |
   | `clave` | Seleccionar variable → píldora **Valor del diccionario** abajo de la acción de **`k`** (paso 9) |
   | `nombre` | Seleccionar variable → píldora **Repetir elemento**. Después **tocá esa variable** y en la lista elegí **Nombre** |
   | `pdf` | Seleccionar variable → píldora **Codificado con Base64** que está **adentro** del Repetir (abajo del paso 7). No la de arriba |

   Escribí las claves exactamente así: en minúscula y `accion` sin tilde.

5. **Controlá que no estén cruzadas `u` y `k`.** Es el error más común:
   - Tocá el *Valor del diccionario* de la URL → **Revelar acción** → se tiene que resaltar la acción de **`u`**.
   - Tocá el *Valor del diccionario* de la fila `clave` → **Revelar acción** → se tiene que resaltar la de **`k`**.
   - Si alguna está al revés: tocala → Borrar → Seleccionar variable → la píldora correcta.

### Paso 11: Leer la respuesta

1. Agregá **Obtener valor del diccionario** y arrastrala abajo del paso 10.
2. **Clave:** `mensaje`.
3. Diccionario: tiene que decir **Contenido de URL**. Normalmente lo pone solo. Si no: Seleccionar variable → la píldora abajo de "Obtener contenido de".

### Paso 12: Mostrar el resultado

1. Buscá **notificación** → **Mostrar notificación**. Arrastrala abajo del paso 11, antes de "Terminar repetición".
2. Borrá el texto que trae ("Hola mundo"), tocá ahí → **Seleccionar variable** → píldora **Valor del diccionario** abajo de la acción de **`mensaje`** (paso 11).
3. Lo demás (Título, Emitir sonido, Archivo adjunto) dejalo como está.

### Así tiene que quedar

```
Recibir PDF de Hoja de compartir
Texto: (tu código)
Decodificar Texto con base64
Obtener diccionario de Codificado con Base64
Repetir con todos los elementos de Entrada de atajo
    Codificar Repetir elemento con base64          (Saltos de línea: Ninguno)
    Obtener Valor de u en Diccionario
    Obtener Valor de k en Diccionario
    Obtener contenido de Valor del diccionario      (POST, JSON: accion, clave, nombre, pdf)
    Obtener Valor de mensaje en Contenido de URL
    Mostrar notificación: Valor del diccionario
Terminar repetición
```

Tocá **‹** (arriba a la izquierda) para guardar y salir.

---

## Parte 3: probarlo

1. En WhatsApp abrí un PDF de CPE → **Compartir** (cuadrado con flecha) → bajá hasta **Mandar a APP-CPE**. Si no aparece, tocá **Editar acciones** al final de la lista y agregalo.
2. La primera vez iOS pregunta si el atajo puede conectarse con `script.google.com`: tocá **Permitir siempre**.
3. Tiene que aparecer la notificación **"✅ … recibida. Abrí la app CPE para completar el lote."**
4. Abrí la app CPE (o tocá **Actualizar**): arriba dice **"Llegó 1 carta desde WhatsApp"**, con la tarjeta ya leída esperando el lote.

### Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| La notificación dice algo con ⚠️ | El mensaje explica qué pasó. *Código inválido*: pegá en el bloque Texto un código nuevo (Parte 1, punto 4). *No es un PDF*: compartí el PDF, no una foto ni un link. |
| Error del atajo sobre la URL o "no se encontró" | La URL y la clave están cruzadas: revisá el paso 10, punto 5. |
| Llega la notificación ✅ pero la app no muestra la carta | 1) Cerrá la app del todo (deslizar hacia arriba), abrila, cerrala y abrila de nuevo: la versión nueva se activa la segunda vez. 2) Fijate que la app esté conectada con el **mismo código** que el atajo (Desconectar → pegar el código → Conectar). |
| La app dice "No pude comunicarme con el script del Excel" | Si el script está bien publicado, casi siempre es el iPhone: desactivá un momento los **bloqueadores de contenido** de Safari (Ajustes → Apps → Safari → Extensiones), el **Relay privado** de iCloud o la **VPN**. Probá también con datos móviles en vez de Wi‑Fi, o abriendo la app en Safari común. |
| Para ver qué PDFs están esperando | En el Drive del dueño de la planilla, carpeta **"CPE pendientes (App CPE)"**. Cada archivo empieza con el nombre de la persona que lo mandó. |

---

## Parte 4: pasárselo a José y Juan

1. **Antes de compartir, borrá tu código del bloque Texto (paso 3).** Si no, ellos cargarían a tu nombre.
2. En Atajos, mantené apretado **Mandar a APP-CPE** → **Compartir** → **Copiar enlace de iCloud**, y mandales ese link.
3. Volvé a pegar tu código en tu atajo.
4. *(Opcional)* En la planilla, **App CPE → 3. Activar recepción por WhatsApp** y pegá ese link. Desde ahí aparece junto a cada código nuevo.
5. Cada uno, en su iPhone:
   1. Si no tiene la app Atajos, la baja de la App Store (es de Apple, gratis).
   2. Abre el link → **Agregar atajo**.
   3. En Atajos, toca **···** en el atajo "Mandar a APP-CPE" → pega **su** código en el bloque Texto → **‹** para guardar.
   4. Se asegura de que la app CPE esté conectada con ese mismo código.
   5. Prueba con un PDF como en la Parte 3.

> Si a alguien le das de baja el código (App CPE → Ver o dar de baja personas), el atajo deja de funcionar para esa persona, igual que la app.
