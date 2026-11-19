// utils/correo.js
// ✉️ Envío de correos (SMTP con nodemailer). Lo usa el panel de Ventas web para mandar la guía de Correos al cliente.
// Variables (api/.env y Render): SMTP_USER, SMTP_PASS y opcionales SMTP_HOST (smtp.gmail.com), SMTP_PORT (465 SSL / 587 STARTTLS),
// SMTP_FROM, SMTP_REPLY_TO (a dónde llegan las respuestas del cliente) y AVISO_VENTAS_CORREO (a quién avisar de cada venta).
// Sirve con cualquier proveedor SMTP (Brevo, Gmail, etc.). ⚠️ Outlook.com personal ya no acepta usuario/contraseña por SMTP.
import nodemailer from 'nodemailer';

const HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const PORT = Number(process.env.SMTP_PORT) || 465;
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const FROM = process.env.SMTP_FROM || (USER ? `ChemaSport ER <${USER}>` : '');
const REPLY_TO = process.env.SMTP_REPLY_TO || 'ChemaSport__ER@outlook.com';
export const CORREO_AVISO_VENTAS = process.env.AVISO_VENTAS_CORREO || 'ChemaSport__ER@outlook.com';

export const correoConfigurado = () => Boolean(USER && PASS);

let transporte = null;
const getTransporte = () => {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,
      auth: { user: USER, pass: PASS },
    });
  }
  return transporte;
};

/** Envía un correo. `adjuntos`: [{ filename, content: Buffer, contentType }] */
export async function enviarCorreo({ para, asunto, html, texto, adjuntos = [] }) {
  if (!correoConfigurado()) throw new Error('Falta configurar SMTP_USER / SMTP_PASS en el servidor');
  return getTransporte().sendMail({
    from: FROM,
    to: para,
    replyTo: REPLY_TO,
    subject: asunto,
    text: texto,
    html,
    attachments: adjuntos,
  });
}

const colones = (n) => `₡${Number(n || 0).toLocaleString('de-DE')}`;

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Correo con la guía de envío. Correos de CR: número de rastreo + PDF adjunto. Mensajero: número de guía y aviso.
 *  `listaYa`: se manda solo apenas se paga (la camiseta todavía se está alistando), no "va en camino". */
export function correoGuia({ nombre, orderNumber, numeroGuia, tipo = 'Correos', listaYa = false }) {
  const rastreo = 'https://correos.go.cr/rastreo/';
  const esCorreos = tipo !== 'Mensajero';
  const asunto = listaYa
    ? `Tu pedido ${orderNumber} está confirmado · Guía ${numeroGuia}`
    : `Tu pedido ${orderNumber} va en camino · Guía ${numeroGuia}`;
  const estadoTxt = listaYa
    ? (esCorreos
      ? 'Ya estamos alistando tu pedido. Lo enviamos por <b>Correos de Costa Rica</b>: con este número lo podés rastrear apenas lo entreguemos en la oficina.'
      : 'Ya estamos alistando tu pedido. Te lo lleva nuestro <b>mensajero</b>: te escribimos por WhatsApp para coordinar la entrega.')
    : (esCorreos
      ? 'Tu pedido ya va en camino por <b>Correos de Costa Rica</b>.'
      : 'Tu pedido ya va en camino con nuestro <b>mensajero</b>.');
  const texto = `¡Hola ${nombre}!\n\n${estadoTxt.replace(/<[^>]+>/g, '')}\nPedido: ${orderNumber}\nNúmero de guía: ${numeroGuia}${esCorreos ? `\nRastrealo en ${rastreo}\n\nTe adjuntamos la guía en PDF.` : ''}\n\nGracias por comprar en ChemaSport ER.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <div style="background:#000;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
      <strong style="font-size:18px;letter-spacing:-0.5px">ChemaSport <span style="background:#fff;color:#000;padding:1px 6px;border-radius:4px;font-size:12px">ER</span></strong>
    </div>
    <div style="border:1px solid #eee;border-top:0;padding:22px;border-radius:0 0 14px 14px">
      <p style="margin:0 0 12px;font-size:16px">¡Hola <b>${esc(nombre)}</b>! 👋</p>
      <p style="margin:0 0 16px;line-height:1.5">Pedido <b>${esc(orderNumber)}</b>. ${estadoTxt}</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:14px 16px;margin:0 0 16px">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#666">Número de guía${esCorreos ? ' (Correos de CR)' : ''}</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:1px">${esc(numeroGuia)}</div>
      </div>
      ${esCorreos ? `<p style="margin:0 0 18px"><a href="${rastreo}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Rastrear mi paquete</a></p>` : ''}
      <p style="margin:0;color:#555;font-size:13px">${esCorreos ? 'Te adjuntamos la guía en PDF. ' : ''}¿Dudas? Escribinos al WhatsApp <a href="https://wa.me/50660369857">6036-9857</a>.</p>
    </div>
  </div>`;
  return { asunto, texto, html };
}

/** 🔔 Aviso interno: se hizo una venta en la tienda online */
export function correoAvisoVenta(o) {
  const prueba = String(o.tilopay?.environment || '').toLowerCase() === 'test';
  const nombre = `${o.cliente?.nombre || ''} ${o.cliente?.apellidos || ''}`.trim();
  const entrega = o.entrega?.tipo === 'mensajero' ? 'Mensajero' : o.entrega?.tipo === 'retiro' ? 'Retiro en tienda' : 'Correos de CR';
  const lugar = [o.entrega?.distrito, o.entrega?.canton, o.entrega?.provincia].filter(Boolean).join(', ');
  const filas = (o.items || [])
    .map((i) => {
      const dorsal = i.dorsal?.name || i.dorsal?.number ? ` · ${String(i.dorsal.name || '').toUpperCase()} #${i.dorsal.number || ''}` : '';
      return `<tr><td style="padding:6px 0">${i.cantidad}× ${esc(i.name)}<br><span style="color:#666;font-size:12px">Talla ${esc(i.talla)}${esc(dorsal)}</span></td><td style="padding:6px 0;text-align:right;font-weight:bold">${colones(i.precio * i.cantidad)}</td></tr>`;
    })
    .join('');
  const asunto = `${prueba ? '[PRUEBA] ' : ''}🛒 Nueva venta web ${o.orderNumber} · ${colones(o.total)} · ${nombre}`;
  const texto = `${prueba ? '[PAGO DE PRUEBA]\n' : ''}Nueva venta ${o.orderNumber} por ${colones(o.total)}\nCliente: ${nombre} · ${o.cliente?.telefono || ''} · ${o.cliente?.correo || ''}\nEntrega: ${entrega} · ${lugar}\n${(o.items || []).map((i) => `${i.cantidad}x ${i.name} (${i.talla})`).join('\n')}`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
    ${prueba ? '<div style="background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:10px;margin-bottom:10px;font-weight:bold">Pago de prueba (Tilopay en modo pruebas): no se cobró nada.</div>' : ''}
    <div style="background:#16a34a;color:#fff;padding:16px 20px;border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.85">Nueva venta web</div>
      <div style="font-size:24px;font-weight:900">${colones(o.total)} · ${esc(o.orderNumber)}</div>
    </div>
    <div style="border:1px solid #eee;border-top:0;padding:18px 20px;border-radius:0 0 14px 14px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}
        <tr><td style="padding:6px 0;color:#666;border-top:1px dashed #ddd">Envío (${entrega})</td><td style="padding:6px 0;text-align:right;border-top:1px dashed #ddd">${o.envio ? colones(o.envio) : 'Gratis'}</td></tr>
      </table>
      <p style="margin:14px 0 4px"><b>${esc(nombre)}</b> · Cédula ${esc(o.cliente?.cedula || '')}</p>
      <p style="margin:0 0 4px">📱 <a href="https://wa.me/506${esc(o.cliente?.telefono || '')}">${esc(o.cliente?.telefono || '')}</a> · ✉️ ${esc(o.cliente?.correo || '')}</p>
      <p style="margin:0 0 4px">📍 ${esc(entrega)}: ${esc(lugar)}</p>
      ${o.entrega?.senas ? `<p style="margin:0 0 4px;color:#444">${esc(o.entrega.senas)}</p>` : ''}
      ${o.notas ? `<p style="margin:8px 0 0;color:#92400e">📝 ${esc(o.notas)}</p>` : ''}
      <p style="margin:16px 0 0"><a href="https://chemasporter.com/ventas-web" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:bold">Abrir Ventas web</a></p>
    </div>
  </div>`;
  return { asunto, texto, html };
}
