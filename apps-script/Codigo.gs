/**
 * App CPE → Excel: script de la Hoja de cálculo compartida.
 *
 * Recibe las filas que mandan los celulares y las AGREGA al final de cada hoja de CPE
 * (nunca reemplaza el archivo). Un candado (LockService) hace que dos cargas al mismo
 * tiempo se escriban una debajo de la otra. Antes de escribir revisa que el CTG no esté cargado.
 *
 * Instalación: ver apps-script/LEEME.md
 */

// Nombre lógico -> textos posibles del encabezado (normalizados). Igual que pwa/js/libro.js
const SINONIMOS = {
  cultivo: ['cultivo'],
  campo: ['campo'],
  lote: ['lote'],
  kgs: ['kgs neto', 'kg neto', 'kilos neto', 'kilos', 'kgs', 'neto'],
  ctg: ['nro ctg', 'n ctg', 'ctg'],
  cpe: ['cpe', 'nro cpe', 'n cpe'],
  patente: ['patente', 'dominio', 'patentes'],
  fecha: ['fecha'],
  transportista: ['transportista', 'transporte', 'empresa transportista'],
  usuario: ['cargado por', 'cargada por', 'usuario'],
};
const COLUMNAS_EXTRA = ['patente', 'fecha', 'transportista'];
const ETIQUETAS = {
  cultivo: 'Cultivo', campo: 'Campo', lote: 'Lote', kgs: 'Kgs Neto', ctg: 'NRO CTG', cpe: 'CPE',
  patente: 'Patente', fecha: 'Fecha', transportista: 'Transportista', usuario: 'Cargado por',
};
const ESPERA_CANDADO_MS = 30000;

// ---------- web app ----------

function doGet() {
  return ContentService.createTextOutput('App CPE → Excel: el script está funcionando.');
}

function doPost(e) {
  let respuesta;
  try {
    const pedido = JSON.parse(e.postData.contents);
    const usuario = usuarioDeClave_(pedido.clave);
    if (!usuario) {
      respuesta = { ok: false, error: 'Código de conexión inválido o dado de baja. Pedí uno nuevo.' };
    } else if (pedido.accion === 'libro') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      respuesta = { ok: true, usuario: usuario, archivo: ss.getName(), hojas: leerHojas_(ss) };
    } else if (pedido.accion === 'agregar') {
      respuesta = agregarFilas_(SpreadsheetApp.getActiveSpreadsheet(), pedido.filas || [], {
        forzar: pedido.forzar || [],
        agregarColumnas: !!pedido.agregarColumnas,
        usuario: usuario,
      });
    } else {
      respuesta = { ok: false, error: 'Acción desconocida: ' + pedido.accion };
    }
  } catch (err) {
    respuesta = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- lectura ----------

function normalizar_(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function vacio_(v) {
  return v === null || v === undefined || v === '';
}

function ctgNum_(v) {
  if (vacio_(v) || v instanceof Date) return null;
  const n = Math.trunc(Number(String(v).trim()));
  return isFinite(n) && n !== 0 ? n : null;
}

// Valor apto para JSON: las fechas y las celdas vacías no le sirven a la app
function plano_(v) {
  return vacio_(v) || v instanceof Date ? null : v;
}

function mapearEncabezados_(encabezados) {
  const cols = {};
  encabezados.forEach(function (valor, i) {
    const h = normalizar_(valor);
    if (!h) return;
    for (const logico in SINONIMOS) {
      if (!(logico in cols) && SINONIMOS[logico].indexOf(h) >= 0) {
        cols[logico] = i + 1;
        break;
      }
    }
  });
  return cols;
}

// valores: matriz desde la fila 1 (getValues). Devuelve el nro de la última fila con datos.
function ultimaFila_(valores, cols) {
  const claves = ['cultivo', 'campo', 'kgs', 'ctg', 'cpe'].filter(function (k) { return k in cols; })
    .map(function (k) { return cols[k]; });
  for (let f = valores.length; f > 1; f--) {
    if (claves.some(function (c) { return !vacio_(valores[f - 1][c - 1]); })) return f;
  }
  return 1;
}

// Hojas de CPE (encabezados CTG y CPE en la fila 1) con lo que la app necesita para sugerir y controlar
function leerHojas_(ss) {
  const hojas = [];
  ss.getSheets().forEach(function (ws) {
    const alto = ws.getLastRow();
    const ancho = ws.getLastColumn();
    if (!alto || !ancho) return;
    const valores = ws.getRange(1, 1, alto, ancho).getValues();
    const cols = mapearEncabezados_(valores[0]);
    if (!cols.ctg || !cols.cpe) return;
    const ultima = ultimaFila_(valores, cols);
    const filas = [];
    for (let f = 2; f <= ultima; f++) {
      const v = function (k) { return k in cols ? plano_(valores[f - 1][cols[k] - 1]) : null; };
      filas.push({ fila: f, cultivo: v('cultivo'), campo: v('campo'), lote: v('lote'), ctg: v('ctg') });
    }
    hojas.push({ nombre: ws.getName(), columnas: cols, filas: filas });
  });
  return hojas;
}

// ---------- escritura ----------

function agregarFilas_(ss, filas, opciones) {
  if (!filas.length) return { ok: false, error: 'No hay filas para agregar.' };
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(ESPERA_CANDADO_MS)) {
    return { ok: false, error: 'El Excel está ocupado con otra carga. Probá de nuevo en unos segundos.' };
  }
  try {
    // Con el candado tomado, se vuelve a mirar el Excel: puede haber cambiado desde que el celular lo leyó
    const indice = {};
    leerHojas_(ss).forEach(function (h) {
      h.filas.forEach(function (f) {
        const n = ctgNum_(f.ctg);
        if (n) (indice[n] = indice[n] || []).push([h.nombre, f.fila]);
      });
    });
    const forzar = (opciones.forzar || []).map(String);
    const duplicados = {};
    filas.forEach(function (f) {
      const n = ctgNum_(f.ctg);
      if (n && indice[n] && forzar.indexOf(String(f.ctg)) < 0) duplicados[f.ctg] = indice[n];
    });
    if (Object.keys(duplicados).length) {
      return {
        ok: false, duplicados: duplicados, hojas: leerHojas_(ss),
        error: 'Hay CTG que ya están cargados (quizás por otra persona). No se guardó nada.',
      };
    }
    filas.forEach(function (f) {
      if (!ss.getSheetByName(f.hoja)) throw new Error("No existe la hoja '" + f.hoja + "'.");
    });

    const escritas = [];
    const avisos = {};
    filas.forEach(function (f) {
      escritas.push([f.hoja, escribirFila_(ss.getSheetByName(f.hoja), f, opciones, avisos)]);
    });
    SpreadsheetApp.flush();
    return { ok: true, filas: escritas, avisos: Object.keys(avisos).sort(), hojas: leerHojas_(ss) };
  } finally {
    candado.releaseLock();
  }
}

function escribirFila_(ws, fila, opciones, avisos) {
  let ancho = Math.max(ws.getLastColumn(), 1);
  const encabezados = ws.getRange(1, 1, 1, ancho).getValues()[0];
  const cols = mapearEncabezados_(encabezados);
  if (!cols.ctg || !cols.cpe) throw new Error("La hoja '" + ws.getName() + "' no tiene columnas CTG y CPE.");

  if (opciones.agregarColumnas) {
    COLUMNAS_EXTRA.forEach(function (extra) {
      if (extra in cols) return;
      let ultimaCol = 0;
      encabezados.forEach(function (v, i) { if (!vacio_(v)) ultimaCol = i + 1; });
      const nueva = ultimaCol + 1;
      if (nueva > ws.getMaxColumns()) ws.insertColumnsAfter(ws.getMaxColumns(), nueva - ws.getMaxColumns());
      const modeloEncabezado = Math.max.apply(null, Object.keys(cols).map(function (k) { return cols[k]; }));
      ws.getRange(1, modeloEncabezado).copyTo(ws.getRange(1, nueva), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      ws.getRange(1, nueva).setValue(ETIQUETAS[extra]);
      encabezados[nueva - 1] = ETIQUETAS[extra];
      cols[extra] = nueva;
    });
    ancho = Math.max(ancho, encabezados.length);
  }

  const valores = ws.getRange(1, 1, Math.max(ws.getLastRow(), 1), ancho).getValues();
  const destino = ultimaFila_(valores, cols) + 1;
  if (destino > ws.getMaxRows()) ws.insertRowsAfter(ws.getMaxRows(), destino - ws.getMaxRows());
  if (destino > 2) { // formato de la fila de arriba
    ws.getRange(destino - 1, 1, 1, ancho).copyTo(ws.getRange(destino, 1, 1, ancho), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }

  // El CTG se escribe como texto o número según lo que predomine en la hoja
  let textos = 0;
  for (let f = 2; f < destino; f++) {
    const v = valores[f - 1][cols.ctg - 1];
    if (typeof v === 'string' && v !== '') textos++;
  }
  const ctgComoTexto = textos > (destino - 2) / 2;

  const datos = {
    cultivo: fila.cultivo, campo: fila.campo, lote: valorLote_(fila.lote), kgs: Number(fila.kgs),
    ctg: ctgComoTexto ? String(fila.ctg) : ctgNum_(fila.ctg), cpe: fila.cpe,
    patente: fila.patente || null, fecha: fechaHoja_(fila.fecha), transportista: fila.transportista || null,
    usuario: opciones.usuario || null,
  };
  Object.keys(datos).forEach(function (clave) {
    const valor = datos[clave];
    if (!(clave in cols)) {
      if (!vacio_(valor) && COLUMNAS_EXTRA.indexOf(clave) >= 0) {
        avisos["'" + fila.hoja + "' no tiene columna " + ETIQUETAS[clave] + ': no se cargó.'] = true;
      }
      return;
    }
    if (vacio_(valor)) return;
    const celda = ws.getRange(destino, cols[clave]);
    if (clave === 'ctg' && ctgComoTexto) celda.setNumberFormat('@');
    if (clave === 'cpe') celda.setNumberFormat('@'); // '00001-00026528' siempre como texto
    celda.setValue(valor);
    if (clave === 'fecha') celda.setNumberFormat('dd/mm/yyyy');
    if (clave === 'ctg' && !ctgComoTexto) celda.setNumberFormat('0');
  });
  return destino;
}

function valorLote_(lote) {
  const l = String(lote == null ? '' : lote).trim();
  return /^\d+$/.test(l) ? parseInt(l, 10) : l;
}

// 'YYYY-MM-DD' -> fecha al mediodía (así ninguna zona horaria la corre de día)
function fechaHoja_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}

// ---------- códigos de conexión (una clave por persona) ----------

function leerClaves_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty('CLAVES') || '{}');
}

function guardarClaves_(claves) {
  PropertiesService.getScriptProperties().setProperty('CLAVES', JSON.stringify(claves));
}

function usuarioDeClave_(clave) {
  if (!clave) return null;
  return leerClaves_()[String(clave)] || null;
}

// ---------- menú en la planilla (para quien administra) ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('App CPE')
    .addItem('1. Configurar', 'configurar')
    .addItem('2. Crear código para una persona', 'crearCodigo')
    .addItem('Ver o dar de baja personas', 'verPersonas')
    .addToUi();
}

function configurar() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const r1 = ui.prompt('Configurar App CPE',
    'Pegá la URL de la aplicación web de este script.\n(Implementar > Administrar implementaciones; termina en /exec)',
    ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const url = r1.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    ui.alert('Esa URL no parece la de la aplicación web: tiene que empezar con https://script.google.com/ y terminar en /exec.');
    return;
  }
  props.setProperty('URL_WEBAPP', url);
  const r2 = ui.prompt('Configurar App CPE',
    'Dirección de la app para el celular (opcional, ej: https://usuario.github.io/cpe-a-excel/)',
    ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() === ui.Button.OK && r2.getResponseText().trim()) {
    props.setProperty('URL_APP', r2.getResponseText().trim());
  }
  ui.alert('Listo. Ahora usá "App CPE > 2. Crear código para una persona" para cada uno.');
}

function crearCodigo() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('URL_WEBAPP');
  if (!url) {
    ui.alert('Primero: App CPE > 1. Configurar.');
    return;
  }
  const r = ui.prompt('Crear código', 'Nombre de la persona (ej: José). Se anota en la columna "Cargado por" si la hoja la tiene.', ui.ButtonSet.OK_CANCEL);
  const nombre = r.getResponseText().trim();
  if (r.getSelectedButton() !== ui.Button.OK || !nombre) return;

  const clave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const claves = leerClaves_();
  claves[clave] = nombre;
  guardarClaves_(claves);

  const codigo = Utilities.base64EncodeWebSafe(JSON.stringify({ u: url, k: clave, n: nombre }), Utilities.Charset.UTF_8)
    .replace(/=+$/, '');
  const app = props.getProperty('URL_APP');
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.4 sans-serif">' +
    '<p>Mandale este código a <b>' + escaparHtml_(nombre) + '</b> (por WhatsApp, por ejemplo). ' +
    'En la app del celular: <b>Conectar</b> → pegar el código.</p>' +
    '<textarea readonly onclick="this.select()" style="width:100%;height:110px;font:12px monospace">' + codigo + '</textarea>' +
    (app ? '<p>App: <a href="' + escaparHtml_(app) + '" target="_blank">' + escaparHtml_(app) + '</a></p>' : '') +
    '<p style="color:#666">Si alguien pierde el celular, dalo de baja en "Ver o dar de baja personas".</p></div>'
  ).setWidth(480).setHeight(330);
  ui.showModalDialog(html, 'Código para ' + nombre);
}

function verPersonas() {
  const ui = SpreadsheetApp.getUi();
  const claves = leerClaves_();
  const nombres = Object.keys(claves).map(function (k) { return claves[k]; });
  if (!nombres.length) {
    ui.alert('Todavía no hay personas con código.');
    return;
  }
  const r = ui.prompt('Personas con acceso',
    nombres.join(', ') + '\n\nPara dar de baja a alguien escribí su nombre exacto (o Cancelar):',
    ui.ButtonSet.OK_CANCEL);
  const baja = r.getResponseText().trim();
  if (r.getSelectedButton() !== ui.Button.OK || !baja) return;
  let cuantas = 0;
  Object.keys(claves).forEach(function (k) {
    if (claves[k] === baja) { delete claves[k]; cuantas++; }
  });
  guardarClaves_(claves);
  ui.alert(cuantas ? baja + ' ya no puede cargar.' : 'No encontré a "' + baja + '".');
}

function escaparHtml_(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
