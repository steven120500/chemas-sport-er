// utils/ordenesWeb.js
// 🛒 Qué pasa cuando una orden web se paga (todo de una vez, sin intervención):
//   1) confirmarPago     → consult a Tilopay; si está aprobada (y el monto calza) la marca "pagada"
//   2) rebajarStockOrden → descuenta inventario (+ impresiones de dorsal) y deja historial
//   3) facturarOrden     → factura en Alegra (electrónica si el cliente la pidió, si no ticket interno) + correo al cliente
//   4) generarGuiaOrden  → guía de Correos de CR o de mensajero + correo al cliente (solo queda alistar la camiseta)
// Cada paso es idempotente (candados atómicos en la BD): se puede llamar varias veces sin duplicar.
// Además, cada 5 min se revisan las órdenes pendientes (por si el cliente cerró la página antes de volver).
import OrdenWeb from '../models/OrdenWeb.js';
import Product from '../models/Product.js';
import { consultarOrden, tilopayConfigurado } from './tilopay.js';
import { ajustarStockPorUbicacion, obtenerMapaProductosAlegra, resolverProductoYPrecioBase } from '../routes/tiendaRoutes.js';
import { ADMIN_ROOM } from './realtime.js';
import { enviarCorreo, correoAvisoVenta, correoGuia, correoConfigurado, CORREO_AVISO_VENTAS } from './correo.js';
import { liberarReservasOrden } from './reservas.js';
import { registrarGuiaCorreos, codigoPostalCCR } from '../routes/correosRoutes.js';
import { pdfGuiaCorreos } from './guiaPdfCorreos.js';
import Guia from '../models/Guia.js';
import { readFileSync } from 'fs';

// 📦 Orden en que se toma el inventario de una venta web (si una ubicación no alcanza, sigue con la próxima)
// Etiquetas que entiende ajustarStockPorUbicacion: "Bodega 1" (stock), "Bodega 2" (bodega), "Tienda" (tienda)
const ORDEN_UBICACIONES = [
  { campo: 'stock', etiqueta: 'Bodega 1' },
  { campo: 'bodega', etiqueta: 'Bodega 2' },
  { campo: 'tienda', etiqueta: 'Tienda' },
];
const VENDEDOR_WEB = 'Tienda Online';

// 🧪 Pagos en ambiente "Test" de Tilopay (switch "Modo pruebas"): rebajan stock igual que uno real
// (si era una prueba, el basurero de Ventas web lo devuelve), pero NO se facturan solos en Alegra:
// la factura de una prueba se hace a mano desde el panel, escogiendo Interno o Electrónica.
export const ID_NUMERACION_INTERNA = 1; // misma numeración interna que la Tienda (tiendaRoutes.js)
export const esPrueba = (o) => String(o?.tilopay?.environment || '').toLowerCase() === 'test';

// Tilopay devuelve el número con prefijo del comercio: "PFC021519-CSW000002"
const mismaOrden = (deTilopay, nuestra) => {
  const t = String(deTilopay || '');
  return t === nuestra || t.endsWith(`-${nuestra}`);
};

const ALEGRA_EMAIL = process.env.ALEGRA_EMAIL || '';
const ALEGRA_TOKEN = process.env.ALEGRA_TOKEN || '';
const alegraAuth = () => Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
let cacheImpuestoExentoId = null;

const nombreCompleto = (o) => `${o.cliente?.nombre || ''} ${o.cliente?.apellidos || ''}`.trim() || 'Cliente Web';

/* ========================================================
   1) Confirmar el pago con Tilopay
   Devuelve la orden actualizada. Si se acaba de pagar, dispara stock + factura.
   ======================================================== */
export async function confirmarPago(orden, io) {
  if (!orden || orden.estado !== 'pendiente' || !tilopayConfigurado()) return orden;

  const transacciones = await consultarOrden(orden.orderNumber);
  const aprobada = transacciones.find(
    (t) => String(t.code) === '1' && mismaOrden(t.orderNumber, orden.orderNumber) && Math.round(Number(t.amount)) === orden.total
  );

  if (!aprobada) {
    if (transacciones.length && transacciones.every((t) => String(t.code) !== '1')) {
      const ultima = transacciones[transacciones.length - 1];
      await OrdenWeb.updateOne({ _id: orden._id }, { tilopay: { code: String(ultima.code), description: ultima.response } });
      orden.tilopay = { code: String(ultima.code), description: ultima.response };
    }
    return orden;
  }

  const pagada = await OrdenWeb.findOneAndUpdate(
    { _id: orden._id, estado: { $ne: 'pagada' } },
    {
      estado: 'pagada',
      pagadaAt: new Date(),
      tilopay: {
        code: String(aprobada.code), description: aprobada.response, auth: aprobada.auth,
        idTransaccion: String(aprobada.id_tilopay || ''), card: aprobada.card, last: aprobada.last, environment: aprobada.environment,
      },
    },
    { new: true }
  );
  if (!pagada) return OrdenWeb.findById(orden._id); // otro proceso ya la marcó

  console.log(`✅ Orden web ${pagada.orderNumber} pagada (₡${pagada.total}) [${aprobada.environment || ''}]`);
  io?.to(ADMIN_ROOM).emit('ordenWebPagada', { orderNumber: pagada.orderNumber, total: pagada.total, cliente: nombreCompleto(pagada) });
  avisarVenta(pagada); // ✉️ correo a la tienda (no bloquea)

  // 📦 Stock primero (rápido, así no se vende dos veces la misma camiseta); la factura corre aparte
  await rebajarStockOrden(pagada._id, io);

  // 🧪 Pago de prueba: el stock sí se rebaja, pero la factura y la guía quedan para hacerlas a mano
  //    (una guía de Correos es real y se cobra)
  if (esPrueba(pagada)) {
    await OrdenWeb.updateOne(
      { _id: pagada._id },
      {
        factura: { estado: 'omitida', error: 'Pago de prueba (Tilopay Test): facturala a mano si querés', at: new Date() },
        ...(pagada.entrega?.tipo !== 'retiro' && { guia: { estado: 'omitida', error: 'Pago de prueba (Tilopay Test): generala a mano si querés' } }),
      }
    );
    return OrdenWeb.findById(pagada._id);
  }

  // 🧾 → 🚚 Factura y, apenas termina (salga bien o mal), la guía. Corre aparte para no hacer esperar al cliente.
  facturarYGuia(pagada._id);
  return OrdenWeb.findById(pagada._id);
}

/** Factura y después genera la guía (nunca lanza: los errores quedan anotados en la orden) */
export function facturarYGuia(ordenId) {
  return facturarOrden(ordenId)
    .catch((e) => console.error('❌ Factura orden web:', e.message))
    .then(() => generarGuiaOrden(ordenId))
    .catch((e) => console.error('❌ Guía orden web:', e.message));
}

/* ✉️ Aviso de venta al correo de la tienda (AVISO_VENTAS_CORREO). Nunca frena el flujo del pago. */
function avisarVenta(orden) {
  if (!correoConfigurado() || !CORREO_AVISO_VENTAS) return;
  const c = correoAvisoVenta(orden.toObject ? orden.toObject() : orden);
  enviarCorreo({ para: CORREO_AVISO_VENTAS, asunto: c.asunto, texto: c.texto, html: c.html })
    .then(() => console.log(`✉️ Aviso de venta ${orden.orderNumber} enviado`))
    .catch((e) => console.warn(`⚠️ No se pudo mandar el aviso de venta ${orden.orderNumber}:`, e.message));
}

/* ========================================================
   2) Rebajar inventario (una sola vez por orden)
   ======================================================== */
export async function rebajarStockOrden(ordenId, io) {
  // 🔒 Candado: solo el primero que llegue rebaja
  const orden = await OrdenWeb.findOneAndUpdate(
    { _id: ordenId, estado: 'pagada', 'stock.estado': { $nin: ['rebajando', 'listo', 'omitido'] } },
    { 'stock.estado': 'rebajando' },
    { new: true }
  );
  if (!orden) return null;

  const movimientos = [];
  const faltantes = [];
  try {
    for (const item of orden.items) {
      const product = await Product.findById(item.productId).lean();
      if (!product) {
        faltantes.push(`${item.cantidad}x ${item.name} (talla ${item.talla}): el producto ya no existe`);
        continue;
      }
      const impresiones = item.dorsal?.name || item.dorsal?.number
        ? Array.from({ length: item.cantidad }, () => ({ name: item.dorsal.name || '', number: item.dorsal.number || '' }))
        : [];

      let pendiente = item.cantidad;
      for (const ubi of ORDEN_UBICACIONES) {
        if (pendiente <= 0) break;
        const hay = parseInt(product?.[ubi.campo]?.[item.talla] ?? 0, 10) || 0;
        const tomar = Math.min(hay, pendiente);
        if (tomar <= 0) continue;
        const r = await ajustarStockPorUbicacion({
          productId: item.productId,
          talla: item.talla,
          ubicacion: ubi.etiqueta,
          cantidad: tomar,
          delta: -1,
          vendedor: VENDEDOR_WEB,
          nombreCliente: `${nombreCompleto(orden)} · Orden ${orden.orderNumber}`,
          crearHistorial: true,
          impresiones: impresiones.splice(0, tomar),
          io,
        });
        movimientos.push({
          productId: item.productId, talla: item.talla, ubicacion: ubi.etiqueta, cantidad: tomar,
          historyId: r.historyId || '', dorsalesDescontados: r.dorsalesDescontados || [],
        });
        pendiente -= tomar;
      }
      if (pendiente > 0) faltantes.push(`${pendiente}x ${item.name} (talla ${item.talla}): no había stock suficiente al pagar`);
    }

    await OrdenWeb.updateOne(
      { _id: orden._id },
      { stock: { estado: 'listo', movimientos, faltantes, at: new Date() } }
    );
    // ⏳ Ya se rebajó el inventario real: las camisetas apartadas en el carrito se sueltan
    await liberarReservasOrden(orden, io).catch((e) => console.warn('⚠️ Liberando reservas:', e.message));
    if (faltantes.length) {
      console.warn(`⚠️ Orden web ${orden.orderNumber}: faltó stock →`, faltantes.join(' | '));
      io?.to(ADMIN_ROOM).emit('ordenWebAlerta', { orderNumber: orden.orderNumber, mensaje: `Faltó stock: ${faltantes.join(', ')}` });
    }
  } catch (err) {
    console.error(`❌ Rebajando stock de ${orden.orderNumber}:`, err);
    await OrdenWeb.updateOne({ _id: orden._id }, { stock: { estado: 'error', movimientos, faltantes, error: err.message, at: new Date() } });
  }
  return OrdenWeb.findById(orden._id);
}

/* ========================================================
   3) Facturar en Alegra (tiquete electrónico, igual que la Tienda) + correo
   ======================================================== */
const tipoIdAlegra = (cedula = '') => (cedula.length === 10 ? 'CJ' : cedula.length >= 11 ? 'DIMEX' : 'CF');

async function alegra(path, { method = 'GET', body } = {}) {
  const r = await fetch(`https://api.alegra.com/api/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${alegraAuth()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function contactoAlegra(cliente) {
  const cedula = String(cliente.cedula || '').replace(/\D/g, '');
  if (!cedula) return 2; // Cliente de contado (mismo default que la Tienda)
  const buscar = await alegra(`/contacts?identification=${cedula}`);
  if (Array.isArray(buscar.data) && buscar.data.length) {
    const id = buscar.data[0].id;
    const upd = {};
    if (cliente.correo) upd.email = cliente.correo;
    if (cliente.telefono) upd.phonePrimary = cliente.telefono;
    if (Object.keys(upd).length) await alegra(`/contacts/${id}`, { method: 'PUT', body: upd }).catch(() => {});
    return id;
  }
  const nuevo = await alegra('/contacts', {
    method: 'POST',
    body: {
      name: `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim() || 'Cliente Web',
      identificationObject: { type: tipoIdAlegra(cedula), number: cedula },
      email: cliente.correo || '',
      phonePrimary: cliente.telefono || undefined,
      type: 'client',
    },
  });
  return nuevo.ok && nuevo.data?.id ? nuevo.data.id : 2;
}

async function impuestoExento() {
  if (cacheImpuestoExentoId) return cacheImpuestoExentoId;
  const r = await alegra('/taxes').catch(() => ({ data: [] }));
  const imp = Array.isArray(r.data) ? r.data.find((t) => String(t.name).toLowerCase().includes('exento') || Number(t.percentage) === 0) : null;
  cacheImpuestoExentoId = imp?.id || 2;
  return cacheImpuestoExentoId;
}

// forzar: el súper admin puede facturar a mano un pago de prueba o una factura omitida
// tipo: 'hacienda' (tiquete electrónico ante Hacienda) | 'interno' (numeración interna, sin Hacienda).
//   Sin tipo → lo que escogió el cliente en el checkout (orden.facturaElectronica).
export async function facturarOrden(ordenId, { forzar = false, tipo } = {}) {
  if (!ALEGRA_EMAIL || !ALEGRA_TOKEN) {
    await OrdenWeb.updateOne({ _id: ordenId }, { 'factura.estado': 'error', 'factura.error': 'Faltan ALEGRA_EMAIL / ALEGRA_TOKEN' });
    return null;
  }
  // 🔒 Candado: no facturar dos veces
  const orden = await OrdenWeb.findOneAndUpdate(
    forzar
      ? { _id: ordenId, estado: 'pagada', 'factura.estado': { $nin: ['facturando', 'lista'] } }
      : { _id: ordenId, estado: 'pagada', 'tilopay.environment': { $ne: 'Test' }, 'factura.estado': { $nin: ['facturando', 'lista', 'omitida'] } },
    { 'factura.estado': 'facturando', 'factura.error': '' },
    { new: true }
  );
  if (!orden) return null;
  const esInterna = tipo ? tipo === 'interno' : orden.facturaElectronica === false;

  try {
    const credentials = alegraAuth();
    const [clientId, taxId, mapa] = await Promise.all([contactoAlegra(orden.cliente), impuestoExento(), obtenerMapaProductosAlegra(credentials)]);

    const items = orden.items.map((i) => {
      const info = resolverProductoYPrecioBase(`${i.name} (${i.type || ''})`, mapa);
      const dorsal = i.dorsal?.name || i.dorsal?.number ? ` · Dorsal ${String(i.dorsal.name || '').toUpperCase()} #${i.dorsal.number || ''}` : '';
      return {
        id: info.idAlegra,
        name: info.nombreProductoAlegra,
        description: `${i.name} (Talla: ${i.talla})${dorsal}`,
        price: Number(i.precio),
        quantity: i.cantidad,
        tax: [{ id: taxId }],
      };
    });
    if (orden.envio > 0) {
      const envio = resolverProductoYPrecioBase('Envio GAM', mapa);
      items.push({
        id: envio.idAlegra,
        name: envio.nombreProductoAlegra,
        description: orden.entrega?.tipo === 'mensajero' ? 'Servicio de Envío (mensajero)' : 'Servicio de Envío (Correos de Costa Rica)',
        price: Number(orden.envio),
        quantity: 1,
        tax: [{ id: taxId }],
      });
    }

    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }); // YYYY-MM-DD en hora de CR
    const payload = (metodo) => ({
      date: hoy,
      dueDate: hoy,
      client: { id: clientId },
      items,
      saleCondition: 'CASH',
      paymentMethod: metodo,
      status: 'open',
      payments: [{ account: { id: 1 }, amount: Number(total.toFixed(2)), date: hoy }],
      economicActivity: '4771.1',
      // Igual que la Tienda: electrónica → tiquete 04 timbrado; interna → numeración propia, sin Hacienda
      ...(esInterna ? { numberTemplate: { id: ID_NUMERACION_INTERNA } } : { documentType: '04', stamp: { generateStamp: true } }),
      observations: `Venta en línea · Orden ${orden.orderNumber} · Tilopay ${orden.tilopay?.idTransaccion || ''}`.trim(),
    });

    let r = await alegra('/invoices?fields=pdf', { method: 'POST', body: payload('CARD') });
    if (!r.ok) r = await alegra('/invoices?fields=pdf', { method: 'POST', body: payload('TRANSFER') }); // mismo respaldo que la Tienda
    if (!r.ok) throw new Error(r.data?.message || `Alegra respondió ${r.status}`);
    const inv = r.data;

    if (!esInterna && inv.id && (!inv.stamp || inv.stamp.legalStatus === 'NOT_SENT')) {
      await alegra('/invoices/stamp', { method: 'POST', body: { ids: [inv.id] } }).catch(() => {});
    }
    let pdfUrl = inv.pdf || inv.pdfUrl || '';
    if (!pdfUrl && inv.id) {
      const pdf = await alegra(`/invoices/${inv.id}?fields=pdf`).catch(() => ({ data: {} }));
      pdfUrl = pdf.data?.pdf || pdf.data?.pdfUrl || '';
    }
    let correoEnviado = false;
    if (orden.cliente?.correo && inv.id) {
      const em = await alegra(`/invoices/${inv.id}/email`, { method: 'POST', body: { emails: [orden.cliente.correo], sendCopyToUser: true } }).catch(() => ({ ok: false }));
      correoEnviado = em.ok;
    }

    await OrdenWeb.updateOne(
      { _id: orden._id },
      {
        factura: {
          estado: 'lista',
          tipo: esInterna ? 'interno' : 'hacienda',
          alegraId: String(inv.id || ''),
          consecutivo: inv.numberTemplate?.fullNumber || String(inv.id || ''),
          pdfUrl,
          correoEnviado,
          error: '',
          at: new Date(),
        },
      }
    );
    console.log(`🧾 Orden web ${orden.orderNumber} facturada en Alegra (${inv.numberTemplate?.fullNumber || inv.id})`);
  } catch (err) {
    console.error(`❌ Facturando ${orden.orderNumber}:`, err.message);
    await OrdenWeb.updateOne({ _id: orden._id }, { 'factura.estado': 'error', 'factura.error': err.message, 'factura.at': new Date() });
  }
  return OrdenWeb.findById(orden._id);
}

/* ========================================================
   4) Guía de envío automática (después de facturar)
   - Correos  → guía REAL en Correos de CR (queda en su historial de /guias) + PDF al correo del cliente
   - Mensajero → guía en la lista de mensajero de /guias + correo al cliente con el número
   - Retiro en tienda → no lleva guía
   Así a la tienda solo le queda alistar la camiseta e imprimir la guía desde Ventas web.
   ======================================================== */
const UBICACIONES = JSON.parse(readFileSync(new URL('./crUbicaciones.json', import.meta.url), 'utf8'));

// 📮 Respaldo APROXIMADO del código postal (solo si no se pudo leer el catálogo de Correos): crUbicaciones.json
// sigue el orden oficial, pero le faltan distritos que se movieron (p. ej. Río Cuarto) y ahí el número se corre.
const codigoPostalPorOrden = (prov, cant, dist) => {
  const ip = UBICACIONES.findIndex((p) => p.n === prov);
  const ic = ip >= 0 ? UBICACIONES[ip].c.findIndex((c) => c.n === cant) : -1;
  const id = ic >= 0 ? UBICACIONES[ip].c[ic].d.indexOf(dist) : -1;
  if (id < 0) return '';
  return `${ip + 1}${String(ic + 1).padStart(2, '0')}${String(id + 1).padStart(2, '0')}`;
};

const fechasCR = (d = new Date()) => ({
  ymd: d.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }),
  fecha: d.toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric' }),
  hora: d.toLocaleTimeString('es-CR', { timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit' }),
});

const detallePaquete = (o) => {
  const n = (o.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  return n ? `${n} ${n === 1 ? 'camiseta' : 'camisetas'}` : 'Paquete';
};

// forzar: desde el panel se puede generar la de un pago de prueba o reintentar una que falló
export async function generarGuiaOrden(ordenId, { forzar = false, por = '' } = {}) {
  // 🔒 Candado: una sola guía por orden
  const orden = await OrdenWeb.findOneAndUpdate(
    {
      _id: ordenId,
      estado: 'pagada',
      'entrega.tipo': { $in: ['mensajero', 'correos'] },
      'guia.numero': { $exists: false },
      'guia.estado': forzar ? { $nin: ['generando', 'lista'] } : { $nin: ['generando', 'lista', 'omitida', 'error'] },
    },
    { 'guia.estado': 'generando', 'guia.error': '' },
    { new: true }
  );
  if (!orden) return null;

  const e = orden.entrega || {};
  const nombre = nombreCompleto(orden);
  const telefono = String(orden.cliente?.telefono || '');
  const { ymd, fecha, hora } = fechasCR();
  const tipo = e.tipo === 'mensajero' ? 'Mensajero' : 'Correos';

  try {
    let numero = '';
    let datos = {};
    let pdf = null;

    if (tipo === 'Mensajero') {
      // Mismo formato que GuiasPage / GuiaPedidoModal
      datos = {
        numeroGuia: `CS-${String(Date.now()).slice(-6)}`,
        nombre,
        provincia: e.provincia || '',
        canton: e.canton || '',
        distrito: e.distrito || '',
        telefono,
        debe: 'No', // ya pagó con tarjeta
        monto: '0',
        meterRaspa: 'No',
        esMayorista: 'No',
        nombreMayorista: '',
        comentarios: [`Orden ${orden.orderNumber}`, e.senas].filter(Boolean).join(' · '),
        fechaYMD: ymd,
        fecha: `${fecha} ${hora}`,
      };
      await Guia.create(datos);
      numero = datos.numeroGuia;
    } else {
      const zip = (await codigoPostalCCR(e.provincia, e.canton, e.distrito).catch(() => '')) || codigoPostalPorOrden(e.provincia, e.canton, e.distrito) || '10101';
      const payload = {
        destNombre: nombre,
        destDireccion: [e.provincia, e.canton, e.distrito].filter(Boolean).join(', ') + (e.senas ? `, ${e.senas}` : ''),
        destTelefono: telefono,
        destZip: zip,
        peso: 500,
        observaciones: `${detallePaquete(orden)} · Orden ${orden.orderNumber}`,
        tipoDestino: 'DOM',
        codigoSucursal: '',
        fechaYyyyMmDd: ymd,
        fechaFormateada: fecha,
      };
      const r = await registrarGuiaCorreos(payload);
      numero = r.numeroGuia;
      datos = {
        enviold: numero,
        nombre: payload.destNombre,
        telefono: payload.destTelefono,
        tipoEnvio: 'Domicilio',
        direccion: payload.destDireccion,
        detalleEnvio: payload.observaciones,
        codigoPostal: payload.destZip,
        codigoSucursal: '',
        fechaYyyyMmDd: ymd,
        fechaFormateada: fecha,
      };
      pdf = await pdfGuiaCorreos(datos).catch((err) => {
        console.warn(`⚠️ PDF de la guía ${numero}:`, err.message);
        return null;
      });
    }

    // ✉️ Correo al cliente con la guía (Correos: con el PDF)
    let correoEnviado = false;
    let correoError = '';
    try {
      if (!orden.cliente?.correo) throw new Error('La orden no tiene correo');
      if (!correoConfigurado()) throw new Error('El envío de correos no está configurado (SMTP)');
      const c = correoGuia({ nombre: orden.cliente?.nombre || '', orderNumber: orden.orderNumber, numeroGuia: numero, tipo, listaYa: true });
      await enviarCorreo({
        para: orden.cliente.correo,
        asunto: c.asunto,
        texto: c.texto,
        html: c.html,
        adjuntos: pdf ? [{ filename: `Guia-${numero}.pdf`, content: pdf, contentType: 'application/pdf' }] : [],
      });
      correoEnviado = true;
    } catch (err) {
      correoError = err.message;
      console.warn(`⚠️ Guía ${numero} de ${orden.orderNumber}: no se pudo enviar el correo:`, err.message);
    }

    await OrdenWeb.updateOne(
      { _id: orden._id },
      { guia: { estado: 'lista', auto: true, error: '', datos, tipo, numero, fecha: new Date(), por: por || 'Automática', correoEnviado, correoError } }
    );
    console.log(`🚚 Orden web ${orden.orderNumber}: guía ${tipo} ${numero} lista${correoEnviado ? ' y enviada al cliente' : ''}`);
  } catch (err) {
    const msg = err.respuesta?.mensaje || err.message;
    console.error(`❌ Guía de ${orden.orderNumber}:`, msg);
    await OrdenWeb.updateOne({ _id: orden._id }, { 'guia.estado': 'error', 'guia.error': msg, 'guia.tipo': tipo });
  }
  return OrdenWeb.findById(orden._id);
}

/* ========================================================
   ⏱️ Respaldo: revisar pendientes de las últimas 24 h cada 5 min
   (si el cliente pagó pero cerró la pestaña antes de volver a la página)
   ======================================================== */
export async function revisarPendientes(io) {
  if (!tilopayConfigurado()) return;
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pendientes = await OrdenWeb.find({ estado: 'pendiente', createdAt: { $gte: desde } }).limit(30);
  for (const o of pendientes) {
    try {
      await confirmarPago(o, io);
    } catch (e) {
      console.warn(`⚠️ Revisando ${o.orderNumber}:`, e.message);
    }
  }
  // Pagadas a las que les quedó algo a medias (p. ej. se reinició el servidor)
  const aMedias = await OrdenWeb.find({
    estado: 'pagada',
    pagadaAt: { $gte: desde },
    $or: [
      { 'stock.estado': { $exists: false } },
      { 'factura.estado': { $exists: false } },
      // guía automática que no llegó a correr (sin número ni estado) y ya terminó la factura
      { 'entrega.tipo': { $ne: 'retiro' }, 'guia.estado': { $exists: false }, 'guia.numero': { $exists: false }, 'factura.estado': { $in: ['lista', 'error'] } },
    ],
  }).limit(30);
  for (const o of aMedias) {
    if (!o.stock?.estado) await rebajarStockOrden(o._id, io).catch(() => {});
    if (!o.factura?.estado) await facturarYGuia(o._id);
    else if (!o.guia?.estado && !o.guia?.numero) await generarGuiaOrden(o._id).catch(() => {});
  }
}

export function programarRevisionOrdenesWeb(io) {
  const tick = () => revisarPendientes(io).catch((e) => console.warn('⚠️ Revisión órdenes web:', e.message));
  setTimeout(tick, 30 * 1000).unref?.();
  setInterval(tick, 5 * 60 * 1000).unref?.();
}
