// utils/reservas.js
// ⏳ Apartado de camisetas del carrito (tienda online).
//  - Al agregar al carrito se aparta la unidad por MINUTOS_APARTADO (10). Otro cliente ve esa talla con una menos.
//  - Al tocar "Pagar" las reservas del carrito se amarran a la orden y se alargan MINUTOS_PAGO (lo que dura Tilopay).
//  - Al confirmarse el pago se rebaja el inventario real y se borran las reservas (liberarReservasOrden).
//  - Cada 20 s se borran las vencidas y se avisa por socket ('apartadasActualizadas') para que todos vean el stock al día.
import mongoose from 'mongoose';
import Reserva from '../models/Reserva.js';

export const MINUTOS_APARTADO = 10;
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
