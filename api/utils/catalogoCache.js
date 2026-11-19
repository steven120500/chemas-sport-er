// utils/catalogoCache.js
// ⚡ Caché en memoria del catálogo PÚBLICO (GET /api/products sin permiso de ver ocultos).
// Cada visitante descarga el catálogo completo de 100 en 100: sin caché eso eran ~8 consultas a Mongo
// por visita. Con esto, 1.000 visitas cuestan casi lo mismo que una.
//
// - La respuesta es EXACTAMENTE la misma que sin caché (mismo JSON); solo se evita repetir la consulta.
// - Se borra entera cada vez que se escribe un producto (hooks en models/Product.js → invalidarCatalogo):
//   ventas, ediciones, POS, tienda online, anulaciones… el cliente ve el stock al día.
// - Respaldo: cada entrada vence a los TTL_MS por si algo escribe sin pasar por Mongoose (scripts, etc.).
// - El personal (canSeeHidden) NO usa caché: siempre consulta en vivo.
// - Si 50 visitantes piden lo mismo a la vez y no está en caché, se hace UNA sola consulta (enCurso).

const TTL_MS = 30 * 1000;
const MAX_ENTRADAS = 500; // búsquedas distintas; al pasarse se borran las más viejas

const cache = new Map(); // clave → { data, at, version }
const enCurso = new Map(); // clave → Promise (para no repetir la misma consulta en paralelo)
let version = 0; // sube con cada escritura: lo que estaba en vuelo con una versión vieja no se guarda

export function invalidarCatalogo() {
  version += 1;
  cache.clear();
  enCurso.clear();
}

/**
 * Devuelve el resultado en caché o ejecuta `consultar()` (una sola vez aunque lleguen varias peticiones iguales).
 * @param {string} clave
 * @param {() => Promise<any>} consultar
 */
export async function catalogoCacheado(clave, consultar) {
  const hit = cache.get(clave);
  if (hit && hit.version === version && Date.now() - hit.at < TTL_MS) return hit.data;

  const pendiente = enCurso.get(clave);
  if (pendiente) return pendiente;

  const v = version;
  const p = (async () => {
    try {
      const data = await consultar();
      if (v === version) {
        if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value);
        cache.set(clave, { data, at: Date.now(), version: v });
      }
      return data;
    } finally {
      if (enCurso.get(clave) === p) enCurso.delete(clave);
    }
  })();
  enCurso.set(clave, p);
  return p;
}
