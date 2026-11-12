// utils/pedidosUtils.js
// Ayudas compartidas de pedidos: fechas de Costa Rica y fotos de Cloudinary.

const TZ = 'America/Costa_Rica';

/** { fechaYMD: 'YYYY-MM-DD', fecha: '11/11/2026, 3:45 p. m.' } en hora de Costa Rica */
export function fechaCR(d = new Date()) {
  const fechaYMD = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const fecha = new Intl.DateTimeFormat('es-CR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(d);
  return { fechaYMD, fecha };
}

/** Agrega una transformación a una URL de Cloudinary (nunca servir el original: ver CLAUDE.md) */
export function cldTransform(url, t) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/${t}/`);
}

/** Fotos de frente y espalda de un producto del catálogo (las 2 primeras) */
export function fotosDeProducto(p) {
  if (!p) return [];
  const urls = (p.images || []).map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean);
  if (!urls.length && p.imageSrc) urls.push(p.imageSrc);
  if (urls.length < 2 && p.imageSrc2 && !urls.includes(p.imageSrc2)) urls.push(p.imageSrc2);
  return urls.slice(0, 2);
}
