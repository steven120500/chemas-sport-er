// utils/pedidosPago.js
// 💰 Pagos de un pedido por encargo: pagado = adelanto + abonos; pendiente = total − pagado.
// (Igual que pagadoDe/saldoDe en api/models/Pedido.js: usar siempre esto, nunca total − adelanto.)
export const abonadoDe = (p) => (p?.abonos || []).reduce((a, x) => a + (Number(x?.monto) || 0), 0);
export const pagadoDe = (p) => (Number(p?.adelanto) || 0) + abonadoDe(p);
export const saldoDe = (p) => Math.max(0, (Number(p?.total) || 0) - pagadoDe(p));
export const METODOS_ABONO = ["SINPE", "Efectivo", "Transferencia", "Datáfono"];
