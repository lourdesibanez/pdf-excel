// Conexión con el script de la Hoja de cálculo compartida (apps-script/Codigo.gs).

const ESPERA_MS = 60_000;

export class SinConexion extends Error {}

// El código que genera el menú "App CPE" de la planilla: base64url de {u: url del script, k: clave, n: nombre}.
// También acepta el link completo (…#conectar=CODIGO).
export function leerCodigo(texto) {
  const crudo = String(texto || "").trim();
  const codigo = (crudo.match(/conectar=([\w-]+)/)?.[1] || crudo).replace(/=+$/, "");
  try {
    const b64 = codigo.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const datos = JSON.parse(new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0))));
    if (!/^https:\/\//.test(datos.u) || !datos.k) throw new Error();
    return { url: datos.u, clave: datos.k, nombre: datos.n || "" };
  } catch {
    throw new Error("Ese código no es válido. Copialo completo del mensaje que te mandaron.");
  }
}

export async function llamar(conexion, accion, datos = {}) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MS);
  let respuesta;
  try {
    // text/plain evita el "preflight" CORS, que Apps Script no responde
    respuesta = await fetch(conexion.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion, clave: conexion.clave, ...datos }),
      signal: corte.signal,
    });
  } catch {
    throw new SinConexion("No hay conexión con el Excel. Revisá la señal y probá de nuevo: lo cargado no se pierde.");
  } finally {
    clearTimeout(reloj);
  }
  if (!respuesta.ok) throw new Error(`El Excel respondió con un error (${respuesta.status}). Probá de nuevo en un rato.`);
  try {
    return await respuesta.json();
  } catch {
    throw new Error("El Excel respondió algo inesperado. Avisale a quien administra la planilla: puede que el script no esté publicado para \"Cualquier persona\".");
  }
}
