// Extractor de Cartas de Porte Electrónicas (CPE) de ARCA/AFIP.
// Port de extractor.py: pdf.js saca el texto, se rearma por líneas (como pdfplumber)
// y se leen los campos con expresiones regulares. El formato de la CPE es fijo: no hace falta IA.

const TOLERANCIA_LINEA = 3; // pt: items con y parecida van en la misma línea

// Items de pdf.js -> texto con una línea por renglón visual, ordenado de arriba a abajo e izq. a der.
export function textoDesdeItems(items) {
  const visibles = items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lineas = [];
  for (const it of visibles) {
    const linea = lineas.at(-1);
    if (linea && Math.abs(linea.y - it.y) <= TOLERANCIA_LINEA) linea.items.push(it);
    else lineas.push({ y: it.y, items: [it] });
  }
  return lineas
    .map(({ items }) => {
      items.sort((a, b) => a.x - b.x);
      let texto = "";
      let fin = null;
      for (const it of items) {
        // Si pdf.js partió una palabra en dos items pegados, no meter espacio
        if (fin !== null) texto += it.x - fin > 1 ? " " : "";
        texto += it.s.trim();
        fin = it.x + it.w;
      }
      return texto;
    })
    .join("\n");
}

export async function textoPdf(datos, pdfjs) {
  const pdf = await pdfjs.getDocument({ data: datos, isEvalSupported: false, verbosity: 0 }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    paginas.push(textoDesdeItems((await pagina.getTextContent()).items));
  }
  await pdf.destroy();
  return paginas.join("\n");
}

function buscar(patron, texto) {
  const m = texto.match(patron);
  return m ? m[1].trim() : "";
}

function entero(valor) {
  const v = valor.replace(/[.,]/g, "").trim();
  return /^\d+$/.test(v) ? parseInt(v, 10) : null;
}

// "11/08/2026" -> "2026-08-11" (las fechas viajan como texto ISO para evitar líos de zona horaria)
function fecha(valor) {
  const m = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

// "20237684436 - BARBESINI CLAUDIO OSCAR" -> ["20237684436", "BARBESINI CLAUDIO OSCAR"]
function cuitNombre(linea) {
  const m = linea.trim().match(/^(\d{11})\s*-\s*(.+)$/);
  return m ? [m[1], m[2].trim()] : ["", linea.trim()];
}

export function parsearTexto(texto, archivo = "") {
  const c = { archivo, advertencias: [] };

  if (!texto.includes("Carta de Porte")) c.advertencias.push("El PDF no parece una Carta de Porte Electrónica.");

  c.nroCpe = buscar(/(\d{5}-\d{8})/, texto);
  c.ctg = buscar(/CTG:\s*(\d+)/, texto);
  c.fecha = fecha(buscar(/Carta de Porte Electr[oó]nica\s+Fecha:\s*(\d{2}\/\d{2}\/\d{4})/, texto)
    || buscar(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/, texto));

  // Sección B - Grano
  c.grano = buscar(/Grano\s*\/\s*(.+?)\s+Tipo:/, texto);
  c.tipoGrano = buscar(/Tipo:\s*(.+?)\s+Campa[ñn]a:/, texto);
  c.campania = buscar(/Campa[ñn]a:\s*(\d+)/, texto);
  c.pesoBruto = entero(buscar(/Peso Bruto\s+([\d.]+)/, texto));
  c.pesoTara = entero(buscar(/Peso Tara\s+([\d.]+)/, texto));
  c.pesoNeto = entero(buscar(/Peso Neto\s+([\d.]+)/, texto));
  if (c.pesoNeto === null && c.pesoBruto && c.pesoTara) c.pesoNeto = c.pesoBruto - c.pesoTara;
  c.observaciones = buscar(/Observaciones:[ \t]*(.*)/, texto);

  // Sección A - Intervinientes
  [c.transportistaCuit, c.transportista] = cuitNombre(buscar(/Empresa Transportista:[ \t]*(.*)/, texto));
  c.chofer = cuitNombre(buscar(/Chofer\s*:[ \t]*(.*)/, texto))[1];
  c.titular = cuitNombre(buscar(/Titular Carta de Porte:[ \t]*(.*)/, texto))[1];
  c.destinatario = cuitNombre(buscar(/Destinatario:[ \t]*(.*)/, texto))[1];

  // Sección E - Transporte
  const partes = buscar(/Dominios:[ \t]*(.*)/, texto).split("-").map((p) => p.trim()).filter(Boolean);
  c.patente = partes[0] || "";
  c.patenteAcoplado = partes[1] || "";

  // Secciones C / D - localidades (la 1ra es procedencia, la 2da destino)
  const locs = [...texto.matchAll(/Localidad:\s*(.+?)\s+Provincia/g)].map((m) => m[1].trim());
  c.localidadOrigen = locs[0] || "";
  c.localidadDestino = locs[1] || "";

  // Sección G - Descarga (puede venir vacía)
  c.netoDescarga = entero(buscar(/Peso Neto \(kg\):\s*([\d.]+)/, texto));

  for (const [campo, nombre] of [["nroCpe", "N° CPE"], ["ctg", "CTG"], ["pesoNeto", "Peso neto"],
    ["grano", "Grano"], ["fecha", "Fecha"]]) {
    if (!c[campo]) c.advertencias.push(`No se pudo leer: ${nombre}`);
  }
  return c;
}

export async function leerCpe(datos, pdfjs, archivo = "") {
  return parsearTexto(await textoPdf(datos, pdfjs), archivo);
}
