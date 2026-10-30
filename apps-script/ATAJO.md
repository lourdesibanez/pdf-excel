# Atajo "Mandar a CPE": del WhatsApp a la app en dos toques

Con este atajo, en WhatsApp tocás el PDF de la carta de porte → **Compartir** → **Mandar a CPE**, y listo. La carta aparece en la app esperando que completes el lote y los kilos. No hace falta guardarla en Archivos.

El PDF espera en tu Drive, en la carpeta "CPE pendientes (App CPE)", **solo hasta que se carga o se descarta**. En ese momento se manda a la papelera de Drive, que Google vacía sola a los 30 días.

---

## Antes: activar la recepción en la planilla (una vez, desde la compu)

1. Pegá el `Codigo.gs` nuevo en Apps Script (**Extensiones → Apps Script**, reemplazá todo y guardá).
2. **Implementar → Administrar implementaciones → lápiz ✏️ → Versión: Nueva versión → Implementar.** La URL no cambia.
3. En la planilla, recargá y andá a **App CPE → 3. Activar recepción por WhatsApp**. Google pide permiso para usar Drive: aceptá, igual que la primera vez.
4. **Generá códigos nuevos** (App CPE → 2. Crear código) para José y Juan. Los códigos nuevos sirven para la app *y* para el atajo. Los viejos siguen andando en la app, pero no en el atajo.

---

## Armar el atajo (una vez, en tu iPhone)

Abrí la app **Atajos** (viene con el iPhone) → **+** (arriba a la derecha) para crear uno nuevo. Arriba, tocá el nombre y ponele **Mandar a CPE**.

Agregá estas acciones en orden. Para cada una, usá el buscador de abajo ("Buscar acciones"):

1. **Texto**. Adentro pegá tu código de conexión, el mismo de la app.
2. **Codificar con base64**. Tocá la palabra azul *Codificar* y cambiala a **Decodificar**. La entrada tiene que ser *Texto*.
3. **Obtener diccionario de entrada**. La entrada tiene que ser *Resultado decodificado* o *Base64 decodificado*.
4. **Repetir con cada elemento**. Tocá la entrada y elegí **Entrada del atajo**. Todo lo que sigue va **adentro** del bloque "Repetir", entre "Repetir" y "Finalizar repetición":
   1. **Codificar con base64**, con *Elemento repetido* como entrada. Tocá la flechita › y poné **Saltos de línea: Ninguno**.
   2. **Obtener valor del diccionario**. Escribí `u` como clave y elegí *Diccionario* (el del paso 3) como diccionario.
   3. **Obtener valor del diccionario**. Clave `k`, Diccionario *Diccionario*.
   4. **Obtener contenido de URL**:
      - **URL:** la variable *Valor del diccionario* del paso 4.2. Mantené apretado el campo → *Seleccionar variable* → tocá el resultado de 4.2.
      - Tocá la flechita › y poné **Método: POST**.
      - **Cuerpo de la solicitud: JSON**. Agregá 4 campos, todos de tipo *Texto*:

        | Clave | Valor |
        |---|---|
        | `accion` | `recibir` (escrito así) |
        | `clave` | variable *Valor del diccionario* del paso **4.3** |
        | `nombre` | variable *Elemento repetido*. Tocala y elegí **Nombre** |
        | `pdf` | variable *Texto codificado en base64* del paso **4.1** |
   5. **Obtener valor del diccionario**. Clave `mensaje`, Diccionario: *Contenido de la URL*.
   6. **Mostrar notificación**, con el texto *Valor del diccionario* del paso 4.5.

Por último, tocá el ícono ⓘ (abajo) y:
- activá **Mostrar en hoja de compartir**;
- arriba de todo, donde dice "Recibir … de *Hoja de compartir*", tocá el tipo y dejá solo **PDF** (o **Archivos**).

### Probarlo

1. En WhatsApp abrí cualquier PDF de CPE → **Compartir** (cuadrado con flecha) → bajá hasta **Mandar a CPE**. Si no aparece, tocá *Editar acciones* y agregalo.
2. La primera vez iOS pregunta si el atajo puede conectarse con `script.google.com`: tocá **Permitir siempre**.
3. Tiene que aparecer la notificación *"✅ … recibida. Abrí la app CPE para completar el lote."*
4. Abrí la app CPE: arriba dice *"Llegó 1 carta desde WhatsApp"*, con la tarjeta ya leída.

Si la notificación dice algo con ⚠️, el mensaje explica qué pasó: código inválido, el archivo no es un PDF, etc.

---

## Pasárselo a José y Juan

1. En Atajos, mantené apretado **Mandar a CPE** → **Compartir** → **Copiar enlace de iCloud**.
2. **Antes de compartir, borrá tu código del bloque Texto (paso 1).** Si no, ellos cargarían a tu nombre.
3. *(Opcional)* En la planilla, **App CPE → 3. Activar recepción por WhatsApp** y pegá ese link. Desde ahí aparece junto a cada código nuevo.
4. Cada uno abre el link en su iPhone → **Agregar atajo** → lo abre (tocá ··· en el atajo) y pega **su** código en el bloque Texto.

> Si a alguien le das de baja el código (App CPE → Ver o dar de baja personas), el atajo deja de funcionar para esa persona, igual que la app.
