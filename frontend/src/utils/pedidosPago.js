// utils/pedidosPago.js
// 💰 Pagos de un pedido por encargo: pagado = adelanto + abonos; pendiente = total − pagado.
// (Igual que pagadoDe/saldoDe en api/models/Pedido.js: usar siempre esto, nunca total − adelanto.)
export const abonadoDe = (p) => (p?.abonos || []).reduce((a, x) => a + (Number(x?.monto) || 0), 0);
export const pagadoDe = (p) => (Number(p?.adelanto) || 0) + abonadoDe(p);
export const saldoDe = (p) => Math.max(0, (Number(p?.total) || 0) - pagadoDe(p));
export const METODOS_ABONO = ["SINPE", "Efectivo", "Transferencia", "Datáfono"];

// 🎟️ Raspas que da el jefe (% de descuento por camisa: cada camisa lleva su propia raspa). 100 = regalada. Igual que RASPAS en api/models/Pedido.js
export const RASPAS = [0, 10, 15, 20, 30, 100];
export const raspaLabel = (r) => (Number(r) >= 100 ? "Regalada" : Number(r) > 0 ? `Raspa ${r}%` : "");
/** Precio de una línea (precio × cantidad) ya con la raspa aplicada */
export const precioItemDe = (it) => Math.round((Number(it?.precio) || 0) * (Number(it?.cantidad) || 1) * (1 - (Number(it?.raspa) || 0) / 100));
/** Raspas que trae el pedido, una por camisa: [{ raspa: 20, cantidad: 2 }, …] (para pedírselas al cliente al cobrar) */
export const raspasDe = (p) => {
  const cuenta = {};
  for (const it of p?.items || []) {
    const r = Number(it?.raspa) || 0;
    if (r > 0) cuenta[r] = (cuenta[r] || 0) + (Number(it?.cantidad) || 1);
  }
  return Object.keys(cuenta).map(Number).sort((a, b) => a - b).map((raspa) => ({ raspa, cantidad: cuenta[raspa] }));
};
/** "2 raspas de 20% y 1 raspa de regalía" ('' si no tiene) */
export const listaRaspas = (p) =>
  raspasDe(p)
    .map(({ raspa, cantidad }) => `${cantidad} ${cantidad === 1 ? "raspa" : "raspas"} de ${raspa >= 100 ? "regalía" : `${raspa}%`}`)
    .join(" y ");
/** Comentario para la guía del mensajero: que recoja la(s) raspa(s) al entregar */
export const textoRecogerRaspa = (p) => {
  const lista = listaRaspas(p);
  return lista ? `RECOGER ${lista.toUpperCase()} AL ENTREGAR` : "";
};
