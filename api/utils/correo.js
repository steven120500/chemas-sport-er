// utils/correo.js
// ✉️ Envío de correos (SMTP con nodemailer). Lo usa el panel de Ventas web para mandar la guía de Correos al cliente.
// Variables (api/.env y Render): SMTP_USER, SMTP_PASS y opcionales SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), SMTP_FROM.
// Con Gmail: SMTP_PASS es una "contraseña de aplicación" (Cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones).
import nodemailer from 'nodemailer';

const HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const PORT = Number(process.env.SMTP_PORT) || 465;
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const FROM = process.env.SMTP_FROM || (USER ? `ChemaSport ER <${USER}>` : '');

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
    subject: asunto,
    text: texto,
    html,
    attachments: adjuntos,
  });
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Correo con la guía de Correos de Costa Rica (PDF adjunto) */
export function correoGuia({ nombre, orderNumber, numeroGuia }) {
  const rastreo = 'https://correos.go.cr/rastreo/';
  const asunto = `Tu pedido ${orderNumber} va en camino · Guía ${numeroGuia}`;
  const texto = `¡Hola ${nombre}!\n\nTu pedido ${orderNumber} ya va en camino por Correos de Costa Rica.\nNúmero de guía: ${numeroGuia}\nRastrealo en ${rastreo}\n\nTe adjuntamos la guía en PDF.\n\nGracias por comprar en ChemaSport ER.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <div style="background:#000;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
      <strong style="font-size:18px;letter-spacing:-0.5px">ChemaSport <span style="background:#fff;color:#000;padding:1px 6px;border-radius:4px;font-size:12px">ER</span></strong>
    </div>
    <div style="border:1px solid #eee;border-top:0;padding:22px;border-radius:0 0 14px 14px">
      <p style="margin:0 0 12px;font-size:16px">¡Hola <b>${esc(nombre)}</b>! 👋</p>
      <p style="margin:0 0 16px;line-height:1.5">Tu pedido <b>${esc(orderNumber)}</b> ya va en camino por <b>Correos de Costa Rica</b>.</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:14px 16px;margin:0 0 16px">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#666">Número de guía</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:1px">${esc(numeroGuia)}</div>
      </div>
      <p style="margin:0 0 18px"><a href="${rastreo}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Rastrear mi paquete</a></p>
      <p style="margin:0;color:#555;font-size:13px">Te adjuntamos la guía en PDF. ¿Dudas? Escribinos al WhatsApp <a href="https://wa.me/50660369857">6036-9857</a>.</p>
    </div>
  </div>`;
  return { asunto, texto, html };
}
