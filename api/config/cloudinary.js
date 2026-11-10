// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * 💸 Transformación "entrante": Cloudinary achica la imagen ANTES de guardarla.
 * Aunque llegue una foto de 4000px / 8 MB desde un celular, se guarda a máx. 1400px
 * con calidad automática. Ahorra almacenamiento y hace más baratas las versiones que se sirven.
 * (Se sirve con f_auto / q_auto desde el frontend, así que no forzamos formato aquí.)
 */
export const UPLOAD_LIMIT = {
  transformation: [{ width: 1400, height: 1400, crop: 'limit', quality: 'auto:good' }],
};

/**
 * Extrae el public_id de una URL de entrega de Cloudinary de NUESTRA cuenta.
 *   https://res.cloudinary.com/<cloud>/image/upload/v123/products/abc.jpg  ->  products/abc
 * Devuelve null si la URL no es de nuestra cuenta o trae transformaciones (no es una URL original).
 */
export function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const m = url.match(/^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/i);
  if (!m || (cloud && m[1] !== cloud)) return null;
  let rest = m[2].split(/[?#]/)[0];
  const segs = rest.split('/');
  // si el primer segmento es una transformación (ej. "f_auto,q_auto"), no es una URL original
  if (segs[0] && /[,]|^[a-z]{1,3}_[^/]+$/.test(segs[0]) && !/^v\d+$/.test(segs[0])) return null;
  if (/^v\d+$/.test(segs[0])) segs.shift();
  rest = segs.join('/');
  return rest.replace(/\.[a-z0-9]+$/i, '') || null;
}

export default cloudinary;
