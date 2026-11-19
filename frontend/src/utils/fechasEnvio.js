// 📦 Cuándo sale y cuándo llega un pedido de la tienda online (hora de Costa Rica).
// ⚠️ Copia exacta en api/utils/fechasEnvio.js — si cambiás una, cambiá la otra.
//
// Reglas del dueño (nov-2026):
// - Mensajero privado: recoge de lunes a viernes a las 3 pm y entrega al día siguiente (martes a sábado).
// - Correos de CR: abre de lunes a viernes; lo llevamos ese mismo día (mismo corte de las 3 pm).
// - Compra después de las 3 pm o en fin de semana → sale el siguiente día hábil.
//   Ej.: sábado/domingo → sale el lunes; mensajero entrega el martes.
// - Mensajero: el cliente puede escoger el día de entrega entre los días del mensajero (martes a sábado),
//   desde el primero posible (antes de las 3 pm → mañana) — ver diasMensajero. La guía sale con ESE día.
// (No toma en cuenta feriados.)

export const HORA_CORTE = 15; // 3 pm

const DIA_MS = 24 * 60 * 60 * 1000;

// Día calendario de Costa Rica como fecha UTC al mediodía (para sumar días sin líos de zona horaria)
const diaCR = (d = new Date()) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return { dia: new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12)), hora: +p.hour };
};

const esHabil = (d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
const masDias = (d, n) => new Date(d.getTime() + n * DIA_MS);
const ymd = (d) => d.toISOString().slice(0, 10);

/** Texto "lunes 23 de noviembre" */
export const fechaLarga = (d) => {
  const f = (o) => d.toLocaleDateString('es-CR', { timeZone: 'UTC', ...o });
  return `${f({ weekday: 'long' })} ${f({ day: 'numeric' })} de ${f({ month: 'long' })}`;
};

/** "hoy" / "mañana" / "el lunes 23 de noviembre" según `desde` */
export const cuandoTexto = (d, desde = new Date()) => {
  const hoy = diaCR(desde).dia;
  const dias = Math.round((d - hoy) / DIA_MS);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `el ${fechaLarga(d)}`;
};

/**
 * Plan de envío para una compra hecha en `fecha`.
 * @param {'mensajero'|'correos'|'retiro'} tipo
 * @returns {null | { despacho: Date, entrega: Date|null, despachoYMD: string, entregaYMD: string }}
 */
export function planEnvio(tipo, fecha = new Date()) {
  if (tipo !== 'mensajero' && tipo !== 'correos') return null;
  const { dia, hora } = diaCR(fecha);
  let despacho = dia;
  if (!esHabil(despacho) || hora >= HORA_CORTE) {
    despacho = masDias(despacho, 1);
    while (!esHabil(despacho)) despacho = masDias(despacho, 1);
  }
  const entrega = tipo === 'mensajero' ? masDias(despacho, 1) : null; // lun→mar … vie→sáb
  return { despacho, entrega, despachoYMD: ymd(despacho), entregaYMD: entrega ? ymd(entrega) : '' };
}

export const DIAS_MENSAJERO_A_ESCOGER = 6;
const esDiaMensajero = (d) => d.getUTCDay() >= 2 && d.getUTCDay() <= 6; // martes a sábado
const deYMD = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null;
};

/** 🛵 Días que el cliente puede escoger para que le llegue el mensajero (el primero = lo más pronto posible) */
export function diasMensajero(fecha = new Date(), n = DIAS_MENSAJERO_A_ESCOGER) {
  const primero = planEnvio('mensajero', fecha).entrega;
  const dias = [];
  for (let d = primero; dias.length < n; d = masDias(d, 1)) if (esDiaMensajero(d)) dias.push({ fecha: d, ymd: ymd(d) });
  return dias;
}

/** ¿Ese YYYY-MM-DD es un día de mensajero válido para una compra hecha en `fecha`? */
export const diaMensajeroValido = (v, fecha = new Date()) => diasMensajero(fecha).some((d) => d.ymd === v);

/**
 * Plan respetando el día que escogió el cliente (mensajero): entrega ese día y se despacha el día hábil anterior.
 * Sin día escogido (o Correos) → planEnvio normal.
 */
export function planConEntrega(tipo, fecha = new Date(), entregaYMD = '') {
  const plan = planEnvio(tipo, fecha);
  const elegido = tipo === 'mensajero' ? deYMD(entregaYMD) : null;
  if (!plan || !elegido) return plan;
  const despacho = masDias(elegido, -1); // mar→lun … sáb→vie
  return { despacho, entrega: elegido, despachoYMD: ymd(despacho), entregaYMD: ymd(elegido) };
}

/** Frase para el cliente. `desde` = cuándo se lee (para decir "hoy"/"mañana"); null = siempre con fecha. */
export function textoEnvio(tipo, fecha = new Date(), desde = fecha, entregaYMD = '') {
  const plan = planConEntrega(tipo, fecha, entregaYMD);
  if (!plan) return '';
  const cuando = (d) => (desde ? cuandoTexto(d, desde) : `el ${fechaLarga(d)}`);
  if (tipo === 'mensajero') {
    return `Lo despachamos ${cuando(plan.despacho)} y nuestro mensajero te lo entrega ${cuando(plan.entrega)}.`;
  }
  return `Lo entregamos a Correos de Costa Rica ${cuando(plan.despacho)}; de ahí tarda de 2 a 4 días hábiles.`;
}
