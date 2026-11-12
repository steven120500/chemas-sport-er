// utils/pedidosLimpieza.js
// 🧹 Borrado automático de pedidos viejos para que la base no se llene.
// Solo borra pedidos COMPLETADOS (ya entregados) hace más de N días.
// Los demás (Nuevo, Pedido, Llegó, Avisado) nunca se borran solos.
// También borra los pedidos semanales viejos que ya se quedaron sin pedidos.
// N = PEDIDOS_RETENCION_DIAS (por defecto 60 ≈ 2 meses).
import Pedido, { ESTADOS_CERRADOS, PedidoLote } from '../models/Pedido.js';
import { publicIdFromUrl } from '../config/cloudinary.js';
import { destroyIfUnused } from './cloudinaryCleanup.js';

const DIA = 24 * 60 * 60 * 1000;

export const diasRetencion = () => {
  const n = parseInt(process.env.PEDIDOS_RETENCION_DIAS || '60', 10);
  return Number.isFinite(n) && n >= 7 ? n : 60; // mínimo 7 días por seguridad
};

export async function limpiarPedidosViejos() {
  try {
    const limite = new Date(Date.now() - diasRetencion() * DIA);
    const filtro = { estado: { $in: ESTADOS_CERRADOS }, cerradoAt: { $ne: null, $lt: limite } };
    const fotos = (await Pedido.find(filtro, 'items.fotos').lean()).flatMap((p) => (p.items || []).flatMap((i) => i.fotos || []));
    const r = await Pedido.deleteMany(filtro);
    // 📸 Fotos subidas en el pedido: se borran de Cloudinary si ya nadie más las usa
    if (r.deletedCount && fotos.length) {
      const ids = [...new Set(fotos.map(publicIdFromUrl).filter(Boolean))];
      destroyIfUnused(ids).catch(() => {});
    }
    if (r.deletedCount) console.log(`🧹 Pedidos: ${r.deletedCount} pedido(s) completado(s) de hace más de ${diasRetencion()} días borrado(s)`);

    const lotesViejos = await PedidoLote.find({ createdAt: { $lt: limite } }, '_id').lean();
    for (const l of lotesViejos) {
      if (!(await Pedido.exists({ lote: l._id }))) await PedidoLote.deleteOne({ _id: l._id });
    }
    return r.deletedCount || 0;
  } catch (err) {
    console.error('🧹 Pedidos: error en la limpieza automática:', err?.message || err);
    return 0;
  }
}

/** Corre al arrancar y luego cada 12 horas */
export function programarLimpiezaPedidos() {
  limpiarPedidosViejos();
  setInterval(limpiarPedidosViejos, 12 * 60 * 60 * 1000).unref?.();
}
