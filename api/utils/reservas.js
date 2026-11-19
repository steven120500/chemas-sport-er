// utils/reservas.js
// ⏳ Apartado de camisetas del carrito (tienda online).
//  - Un solo reloj por carrito: la primera camiseta aparta MINUTOS_APARTADO (10) y cada extra suma MINUTOS_POR_EXTRA (2),
//    hasta MINUTOS_MAX_APARTADO. Todas las reservas del carrito vencen juntas. Otro cliente ve esa talla con una menos.
//  - Al tocar "Pagar" las reservas del carrito se amarran a la orden y se alargan MINUTOS_PAGO (lo que dura Tilopay).
//  - Al confirmarse el pago se rebaja el inventario real y se borran las reservas (liberarReservasOrden).
//  - Cada 20 s se borran las vencidas y se avisa por socket ('apartadasActualizadas') para que todos vean el stock al día.
import mongoose from 'mongoose';
import Reserva from '../models/Reserva.js';
import Product from '../models/Product.js';

export const MINUTOS_APARTADO = 10; // ⏳ la primera camiseta del carrito
export const MINUTOS_POR_EXTRA = 2; // ➕ cada camiseta extra le suma 2 min al mismo reloj (no otros 10)
export const MINUTOS_MAX_APARTADO = 30; // 🔒 tope del reloj del carrito (para que nadie acapare tallas)
export const MINUTOS_PAGO = 20;

/** { productId: { talla: cantidad } } de las reservas vivas (opcional: solo esos productos / sin un carrito) */
export async function apartadas({ productIds, excluirCarrito } = {}) {
  const filtro = { expiresAt: { $gt: new Date() } };
  if (productIds) filtro.productId = { $in: productIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  if (excluirCarrito) filtro.carritoId = { $ne: excluirCarrito };
  const filas = await Reserva.aggregate([
    { $match: filtro },
    { $group: { _id: { p: '$productId', t: '$talla' }, n: { $sum: '$cantidad' } } },
  ]);
  const mapa = {};
  for (const f of filas) {
    const pid = String(f._id.p);
    (mapa[pid] ||= {})[f._id.t] = f.n;
  }
  return mapa;
}

/** 📡 Avisa a todos (público) cuántas hay apartadas de esos productos */
export async function emitirApartadas(io, productIds = []) {
  if (!io || !productIds.length) return;
  const ids = [...new Set(productIds.map(String))];
  const mapa = await apartadas({ productIds: ids });
  for (const id of ids) io.emit('apartadasActualizadas', { productId: id, apartadas: mapa[id] || {} });
}

/** Borra las reservas de una orden ya pagada (el stock real ya se rebajó) o de un carrito */
export async function liberarReservasOrden(orden, io) {
  const or = [{ orderNumber: orden.orderNumber }];
  if (orden.carritoId) or.push({ carritoId: orden.carritoId });
  const reservas = await Reserva.find({ $or: or }).select('productId').lean();
  if (!reservas.length) return;
  await Reserva.deleteMany({ _id: { $in: reservas.map((r) => r._id) } });
  await emitirApartadas(io, reservas.map((r) => r.productId));
}

/** 🧹 Borra las vencidas y avisa */
async function limpiarVencidas(io) {
  const vencidas = await Reserva.find({ expiresAt: { $lte: new Date() } }).select('productId').limit(500).lean();
  if (!vencidas.length) return;
  await Reserva.deleteMany({ _id: { $in: vencidas.map((r) => r._id) } });
  await emitirApartadas(io, vencidas.map((r) => r.productId));
}

export function programarLimpiezaReservas(io) {
  const tick = () => limpiarVencidas(io).catch((e) => console.warn('⚠️ Limpieza de reservas:', e.message));
  setInterval(tick, 20 * 1000).unref?.();
}

/* ========================================================
   🛍️ Si el stock real baja (venta en tienda, POS, edición) y ya no alcanza para lo apartado,
   se le quita el sobrante a los carritos que apartaron de último. El cliente lo nota porque su
   carrito vuelve a leer sus reservas al recibir 'apartadasActualizadas' y le avisa "se vendió".
   Las reservas amarradas a una orden (cliente ya en Tilopay) no se tocan: si falta stock al pagar,
   la orden queda con "Faltó stock" en /ventas-web.
   ======================================================== */
const STOCK_UBICACIONES = ['tienda', 'stock', 'bodega'];
const colaPorProducto = new Map(); // 🔒 una revisión a la vez por producto

async function recortarReservas(io, productId) {
  const vivas = await Reserva.find({ productId, expiresAt: { $gt: new Date() }, orderNumber: { $in: [null, ''] } })
    .sort({ createdAt: -1 }) // 👈 las más nuevas primero
    .lean();
  if (!vivas.length) return;
  const p = await Product.findById(productId).select(STOCK_UBICACIONES.join(' ')).lean();
  const stockDe = (talla) => (p ? STOCK_UBICACIONES.reduce((s, k) => s + (parseInt(p?.[k]?.[talla] ?? 0, 10) || 0), 0) : 0);

  const porTalla = new Map();
  for (const r of vivas) (porTalla.get(r.talla) || porTalla.set(r.talla, []).get(r.talla)).push(r);

  let cambio = false;
  for (const [talla, lista] of porTalla) {
    let sobra = lista.reduce((s, r) => s + r.cantidad, 0) - stockDe(talla);
    for (const r of lista) {
      if (sobra <= 0) break;
      const quitar = Math.min(sobra, r.cantidad);
      if (quitar >= r.cantidad) await Reserva.deleteOne({ _id: r._id });
      else await Reserva.updateOne({ _id: r._id }, { $inc: { cantidad: -quitar } });
      sobra -= quitar;
      cambio = true;
    }
  }
  if (cambio) {
    console.log(`🛍️ Stock de ${productId} bajó: se soltaron apartados de carritos que ya no alcanzaban`);
    await emitirApartadas(io, [productId]);
  }
}

export function ajustarReservasAlStock(io, productId) {
  if (!io || !productId || !mongoose.isValidObjectId(String(productId))) return;
  const id = String(productId);
  const previa = colaPorProducto.get(id) || Promise.resolve();
  const sig = previa
    .then(() => recortarReservas(io, id))
    .catch((e) => console.warn('⚠️ Ajustando apartados al stock:', e.message))
    .finally(() => { if (colaPorProducto.get(id) === sig) colaPorProducto.delete(id); });
  colaPorProducto.set(id, sig);
}
