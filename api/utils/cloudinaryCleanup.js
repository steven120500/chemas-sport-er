// utils/cloudinaryCleanup.js
// Borra de Cloudinary imágenes que dejaron de usarse (reemplazadas al editar o de productos eliminados).
// Antes de borrar verifica que NINGÚN otro producto ni factura de tienda la siga referenciando.
import cloudinary, { publicIdFromUrl } from '../config/cloudinary.js';
import Product from '../models/Product.js';
import TiendaFactura from '../models/TiendaFactura.js';
import Pedido from '../models/Pedido.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Todos los public_id que usa un producto (fotos principales + imágenes de dorsales). */
export function productImageIds(product) {
  const ids = new Set();
  if (!product) return ids;
  for (const img of product.images || []) {
    const id = img?.public_id || publicIdFromUrl(typeof img === 'string' ? img : img?.url);
    if (id) ids.add(id);
  }
  for (const url of [product.imageSrc, product.imageSrc2]) {
    const id = publicIdFromUrl(url);
    if (id) ids.add(id);
  }
  for (const opt of product.dorsalOptions || []) {
    const id = publicIdFromUrl(opt?.imageUrl);
    if (id) ids.add(id);
  }
  return ids;
}

async function isStillReferenced(publicId, excludeProductId) {
  const rx = new RegExp(`/${escapeRegex(publicId)}\\.[a-z0-9]+`, 'i');
  const productFilter = {
    $or: [
      { 'images.public_id': publicId },
      { 'images.url': rx },
      { imageSrc: rx },
      { imageSrc2: rx },
      { 'dorsalOptions.imageUrl': rx },
    ],
  };
  if (excludeProductId) productFilter._id = { $ne: excludeProductId };

  const [inProduct, inFactura, inPedido] = await Promise.all([
    Product.exists(productFilter),
    // las facturas guardan la miniatura para reimprimir el tiquete
    TiendaFactura.exists({ 'ventas.imagen': rx }),
    // 🧾 los pedidos guardan las fotos de frente/espalda de la camiseta encargada
    Pedido.exists({ $or: [{ 'items.fotos': rx }, { 'items.fotoParche': rx }] }), // + foto del parche
  ]);
  return Boolean(inProduct || inFactura || inPedido);
}

/**
 * Borra (best-effort) los public_id que ya no use nadie. Nunca lanza error:
 * si algo falla solo se registra en consola, para no afectar la venta/edición.
 */
export async function destroyIfUnused(publicIds, { excludeProductId } = {}) {
  const list = [...new Set([...(publicIds || [])].filter(Boolean))];
  const deleted = [];
  for (const id of list) {
    try {
      if (await isStillReferenced(id, excludeProductId)) continue;
      const r = await cloudinary.uploader.destroy(id, { resource_type: 'image' });
      if (r?.result === 'ok') deleted.push(id);
    } catch (err) {
      console.error(`🧹 No se pudo borrar ${id} de Cloudinary:`, err?.message || err);
    }
  }
  if (deleted.length) console.log(`🧹 Cloudinary: ${deleted.length} imagen(es) sin uso borrada(s)`);
  return deleted;
}
