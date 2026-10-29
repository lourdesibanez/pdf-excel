// Guardado local en el teléfono (IndexedDB): el Excel de trabajo y las preferencias.
const BASE = "cpe-a-excel";
const ALMACEN = "kv";

let conexion;
function abrir() {
  conexion ??= new Promise((ok, mal) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
  return conexion;
}

async function operar(modo, accion) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const pedido = accion(db.transaction(ALMACEN, modo).objectStore(ALMACEN));
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}

export const leer = (clave) => operar("readonly", (s) => s.get(clave));
export const guardar = (clave, valor) => operar("readwrite", (s) => s.put(valor, clave));
export const borrar = (clave) => operar("readwrite", (s) => s.delete(clave));
