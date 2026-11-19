// routes/checkoutRoutes.js
// 🛒 Rutas PÚBLICAS del checkout de la tienda online (el cliente no tiene sesión).
// ⚠️ Todo lo que se agregue acá es público: limitar por IP y devolver solo lo mínimo.
import crypto from 'crypto';
import { textoEnvio, planEnvio, diaMensajeroValido } from '../utils/fechasEnvio.js'; // 📦 cuándo sale / cuándo llega
import express from 'express';
import mongoose from 'mongoose';
import { rateLimit, requireSuper } from '../middleware/auth.js';

// 🏪 Panel de ventas web: súper usuario o perfil "tienda" (rol tienda o usuario con "tienda" en el nombre, igual que el Header)
const requireVentasWeb = (req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Necesitás iniciar sesión.', code: 'AUTH_REQUIRED' });
  const u = req.user;
  if (u.isSuperUser || (u.roles || []).includes('tienda') || String(u.name || '').toLowerCase().includes('tienda')) return next();
  return res.status(403).json({ error: 'No tenés permisos para esta acción.', code: 'FORBIDDEN' });
};
import Product from '../models/Product.js';
import OrdenWeb, { siguienteNumeroOrdenWeb } from '../models/OrdenWeb.js';
import { costoEnvio } from '../utils/coberturaMensajero.js';
import { tilopayConfigurado, crearPago, ISO_PROVINCIA } from '../utils/tilopay.js';
import { confirmarPago, rebajarStockOrden, facturarOrden, generarGuiaOrden } from '../utils/ordenesWeb.js';
import Reserva from '../models/Reserva.js';
import { apartadas, emitirApartadas, MINUTOS_APARTADO, MINUTOS_POR_EXTRA, MINUTOS_MAX_APARTADO, MINUTOS_PAGO } from '../utils/reservas.js';
import { ajustarStockPorUbicacion } from './tiendaRoutes.js';
import History from '../models/History.js';
import { enviarCorreo, correoGuia, correoConfigurado } from '../utils/correo.js';
import { readFileSync } from 'fs';

const router = express.Router();

// 🗺️ Catálogo oficial provincias → cantones → distritos (copia de frontend/src/utils/crUbicaciones.json)
const UBICACIONES = JSON.parse(readFileSync(new URL('../utils/crUbicaciones.json', import.meta.url), 'utf8'));

// 🔍 Cache en memoria de cédulas consultadas (evita repetir llamadas al escribir/borrar)
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map(); // cedula -> { data, exp }

const limpiarCache = () => {
  if (cache.size <= CACHE_MAX) return;
  const sobran = cache.size - CACHE_MAX;
  let i = 0;
  for (const k of cache.keys()) {
    if (i++ >= sobran) break;
    cache.delete(k);
  }
};

const fetchConTimeout = async (url, ms = 6000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(t);
  }
};

const titulo = (s = '') =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s|-)(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase());

// 1️⃣ Padrón del TSE vía GoMeta (personas físicas, actualizado casi a diario)
async function buscarTSE(cedula) {
  const r = await fetchConTimeout(`https://apis.gometa.org/cedulas/${cedula}`);
  if (!r.ok) return null;
  const data = await r.json();
  const p = Array.isArray(data?.results) ? data.results[0] : null;
  if (!p) return null;
  const nombre = p.firstname || p.firstname1 || '';
  const apellidos = [p.lastname1, p.lastname2].filter(Boolean).join(' ') || p.lastname || '';
  if (!nombre && !apellidos) return p.fullname ? { nombre: titulo(p.fullname), apellidos: '', fuente: 'tse' } : null;
  return { nombre: titulo(nombre), apellidos: titulo(apellidos), fuente: 'tse' };
}

// 2️⃣ Hacienda (contribuyentes: jurídicas, DIMEX, personas inscritas). Solo trae el nombre completo.
async function buscarHacienda(cedula) {
  const r = await fetchConTimeout(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedula}`);
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.nombre) return null;
  const tipo = String(data?.tipoIdentificacion || '');
  // Jurídica (02): todo es razón social, va en "nombre"
  if (tipo === '02') return { nombre: titulo(data.nombre), apellidos: '', fuente: 'hacienda' };
  // Física: Hacienda devuelve "APELLIDO1 APELLIDO2 NOMBRE(S)"
  const partes = titulo(data.nombre).split(' ');
  if (partes.length >= 3) return { nombre: partes.slice(2).join(' '), apellidos: partes.slice(0, 2).join(' '), fuente: 'hacienda' };
  return { nombre: titulo(data.nombre), apellidos: '', fuente: 'hacienda' };
}

/* ========================================================
   🔍 GET /api/checkout/cedula/:cedula → { encontrado, nombre, apellidos, fuente }
   Pública + limitada (30 consultas / 15 min por IP). No toca la BD ni los contactos de Alegra.
   ======================================================== */
router.get(
  '/cedula/:cedula',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Demasiadas consultas de cédula. Probá en unos minutos.' }),
  async (req, res) => {
    const cedula = String(req.params.cedula || '').replace(/\D/g, '');
    if (!/^\d{9,12}$/.test(cedula)) return res.status(400).json({ error: 'Cédula inválida.' });

    const enCache = cache.get(cedula);
    if (enCache && enCache.exp > Date.now()) return res.json(enCache.data);

    try {
      let r = null;
      // Físicas nacionales (9 dígitos) → TSE primero; el resto → Hacienda primero
      const orden = cedula.length === 9 ? [buscarTSE, buscarHacienda] : [buscarHacienda, buscarTSE];
      for (const fn of orden) {
        try {
          r = await fn(cedula);
        } catch (e) {
          console.warn(`⚠️ Consulta de cédula (${fn.name}) falló:`, e.message);
        }
        if (r) break;
      }

      const data = r ? { encontrado: true, ...r } : { encontrado: false };
      cache.set(cedula, { data, exp: Date.now() + (r ? CACHE_MS : 60 * 60 * 1000) });
      limpiarCache();
      res.json(data);
    } catch (error) {
      console.error('❌ Error consultando cédula:', error);
      res.status(500).json({ error: 'No se pudo consultar la cédula.' });
    }
  }
);

/* ========================================================
   💳 POST /api/checkout → crea la orden (pendiente) y devuelve { url } de Tilopay
   El navegador manda solo QUÉ quiere (productos, tallas, cantidades, entrega);
   precios, stock, envío y total se calculan acá desde la BD.
   ======================================================== */
const FRONT_POR_DEFECTO = 'https://chemasporter.com';
const ORIGENES = ['https://chemasporter.com', 'https://www.chemasporter.com', 'https://chemasport-er.onrender.com'];
const origenFront = (req) => {
  const o = String(req.headers.origin || '');
  return ORIGENES.includes(o) || /^http:\/\/localhost:\d+$/.test(o) ? o : FRONT_POR_DEFECTO;
};

const txt = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const stockDe = (p, talla) =>
  ['tienda', 'stock', 'bodega'].reduce((s, k) => s + (parseInt(p?.[k]?.[talla] ?? 0, 10) || 0), 0);
const precioDe = (p) => {
  const precio = Number(p.price) || 0;
  const oferta = Number(p.discountPrice) || 0;
  return oferta > 0 && oferta < precio ? oferta : precio;
};
const ubicacionValida = (prov, cant, dist) => {
  const p = UBICACIONES.find((x) => x.n === prov);
  const c = p?.c.find((x) => x.n === cant);
  return Boolean(c && c.d.includes(dist));
};

/* ========================================================
   ⏳ APARTADO DE CAMISETAS EN EL CARRITO (10 min + 2 por camiseta extra)
   El carrito del navegador tiene un id aleatorio (carritoId). Cada producto+talla del carrito
   tiene una reserva; todas vencen juntas (un solo reloj por carrito). Mientras tanto nadie más
   puede llevarse esas unidades.
   ======================================================== */
const carritoValido = (v) => /^[a-zA-Z0-9_-]{16,64}$/.test(String(v || ''));
const limiteReservas = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: 'Demasiados cambios en el carrito. Probá en unos minutos.' });

// GET /api/checkout/apartadas → { productId: { talla: n } } de todas las reservas vivas (para restar en el catálogo)
router.get('/apartadas', limiteReservas, async (req, res) => {
  try {
    res.json(await apartadas());
  } catch (error) {
    console.error('❌ Leyendo apartadas:', error.message);
    res.status(500).json({ error: 'No se pudo leer el stock apartado.' });
  }
});

// GET /api/checkout/reservas/:carritoId → reservas vivas de ese carrito [{ productId, talla, cantidad, expiresAt }]
router.get('/reservas/:carritoId', limiteReservas, async (req, res) => {
  try {
    if (!carritoValido(req.params.carritoId)) return res.status(400).json({ error: 'Carrito inválido.' });
    const reservas = await Reserva.find({ carritoId: req.params.carritoId, expiresAt: { $gt: new Date() } })
      .select('productId talla cantidad expiresAt -_id').lean();
    res.json({ reservas, ahora: Date.now() });
  } catch (error) {
    console.error('❌ Leyendo reservas:', error.message);
    res.status(500).json({ error: 'No se pudo leer el carrito.' });
  }
});

// PUT /api/checkout/reservas { carritoId, productId, talla, cantidad }
// Deja apartadas `cantidad` unidades de esa talla para ese carrito (0 = soltarlas).
// ⏳ Un solo reloj por carrito: si el carrito no tenía nada apartado arranca en 10 min; si ya tenía,
// cada camiseta extra le suma 2 min al reloj que ya corría (tope 30 min). Si se baja, el reloj sigue igual.
router.put('/reservas', limiteReservas, async (req, res) => {
  try {
    const { carritoId, productId } = req.body || {};
    const talla = txt(req.body?.talla, 10);
    const cantidad = Math.trunc(Number(req.body?.cantidad));
    if (!carritoValido(carritoId)) return res.status(400).json({ error: 'Carrito inválido.' });
    if (!mongoose.isValidObjectId(productId) || !talla) return res.status(400).json({ error: 'Producto inválido.' });
    if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > 30) return res.status(400).json({ error: 'Cantidad inválida.' });
    const io = req.app.get('io');
    const clave = { carritoId, productId, talla };

    if (cantidad === 0) {
      await Reserva.deleteOne(clave);
      await emitirApartadas(io, [productId]);
      return res.json({ ok: true, cantidad: 0 });
    }

    const p = await Product.findById(productId).lean();
    if (!p || p.hidden) return res.status(404).json({ error: 'Esta camiseta ya no está disponible.' });
    const stock = stockDe(p, talla);
    const otros = (await apartadas({ productIds: [productId], excluirCarrito: carritoId }))[String(productId)]?.[talla] || 0;
    const libres = Math.max(0, stock - otros);
    if (cantidad > libres) {
      return res.status(409).json({
        error: libres > 0
          ? `Solo quedan ${libres} disponibles en talla ${talla}.`
          : otros > 0
            ? `Otro cliente tiene apartada la última talla ${talla}. Si no la compra, se libera en unos minutos.`
            : `Se agotó la talla ${talla}.`,
        libres,
      });
    }

    const ahora = new Date();
    const previa = await Reserva.findOne({ ...clave, expiresAt: { $gt: ahora } }).lean();
    const antes = previa?.cantidad || 0;
    // Reloj actual del carrito (reservas vivas que no están amarradas a un pago en curso)
    const delCarrito = { carritoId, expiresAt: { $gt: ahora }, orderNumber: { $in: [null, ''] } };
    const ultima = await Reserva.findOne(delCarrito).sort({ expiresAt: -1 }).select('expiresAt').lean();
    const MIN = 60 * 1000;
    let expiresAt;
    if (cantidad <= antes) expiresAt = ultima?.expiresAt || previa?.expiresAt || new Date(ahora.getTime() + MINUTOS_APARTADO * MIN);
    else if (!ultima) expiresAt = new Date(ahora.getTime() + (MINUTOS_APARTADO + (cantidad - antes - 1) * MINUTOS_POR_EXTRA) * MIN);
    else expiresAt = new Date(new Date(ultima.expiresAt).getTime() + (cantidad - antes) * MINUTOS_POR_EXTRA * MIN);
    const tope = new Date(ahora.getTime() + MINUTOS_MAX_APARTADO * MIN);
    if (expiresAt > tope) expiresAt = tope;
    await Reserva.updateOne(clave, { $set: { cantidad, expiresAt }, $unset: { orderNumber: 1 } }, { upsert: true });

    // 🏁 Dos clientes al mismo tiempo: se vuelve a contar y, si nos pasamos, se deshace
    const total = (await apartadas({ productIds: [productId] }))[String(productId)]?.[talla] || 0;
    if (total > stock) {
      if (previa) await Reserva.updateOne(clave, { $set: { cantidad: previa.cantidad, expiresAt: previa.expiresAt } });
      else await Reserva.deleteOne(clave);
      return res.status(409).json({ error: `Otro cliente acaba de apartar la última talla ${talla}.`, libres: Math.max(0, libres - (total - stock)) });
    }

    // 🔗 Todo el carrito vence a la misma hora
    await Reserva.updateMany(delCarrito, { $set: { expiresAt } });

    await emitirApartadas(io, [productId]);
    res.json({ ok: true, cantidad, expiresAt, ahora: Date.now() });
  } catch (error) {
    console.error('❌ Apartando camiseta:', error.message);
    res.status(500).json({ error: 'No se pudo apartar la camiseta. Probá de nuevo.' });
  }
});

router.post(
  '/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: 'Demasiados intentos de pago. Probá en unos minutos.' }),
  async (req, res) => {
    try {
      if (!tilopayConfigurado()) {
        console.error('❌ Checkout: faltan TILOPAY_API_USER / TILOPAY_API_PASSWORD / TILOPAY_API_KEY');
        return res.status(503).json({ error: 'El pago con tarjeta no está disponible en este momento. Probá por WhatsApp.' });
      }
      const { cliente = {}, entrega = {}, items = [], notas = '' } = req.body || {};
      const carritoId = carritoValido(req.body?.carritoId) ? String(req.body.carritoId) : '';
      // Sin el campo (frontend viejo) → electrónica, como antes; el checkout nuevo siempre lo manda
      const facturaElectronica = req.body?.facturaElectronica !== false;

      // 👤 Cliente
      const c = {
        cedula: txt(cliente.cedula, 20).replace(/\D/g, ''),
        nombre: txt(cliente.nombre, 80),
        apellidos: txt(cliente.apellidos, 80),
        telefono: txt(cliente.telefono, 20).replace(/\D/g, ''),
        correo: txt(cliente.correo, 120).toLowerCase(),
      };
      if (!/^\d{9,12}$/.test(c.cedula)) return res.status(400).json({ error: 'Cédula inválida.' });
      if (!c.nombre || !c.apellidos) return res.status(400).json({ error: 'Faltan nombre o apellidos.' });
      if (!/^[2-8]\d{7}$/.test(c.telefono)) return res.status(400).json({ error: 'Teléfono inválido.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.correo)) return res.status(400).json({ error: 'Correo inválido.' });

      // 📍 Entrega
      const e = {
        tipo: txt(entrega.tipo, 20),
        provincia: txt(entrega.provincia, 60),
        canton: txt(entrega.canton, 60),
        distrito: txt(entrega.distrito, 60),
        senas: txt(entrega.senas, 400),
      };
      // 🛵 Día de entrega escogido (solo mensajero): tiene que ser uno de los días que se le ofrecieron
      if (e.tipo === 'mensajero') {
        const dia = txt(entrega.fechaEntrega, 10);
        if (dia && !diaMensajeroValido(dia)) return res.status(400).json({ error: 'Ese día de entrega ya no está disponible. Escogé otro.' });
        e.fechaEntrega = dia || planEnvio('mensajero').entregaYMD;
      }
      if (!ubicacionValida(e.provincia, e.canton, e.distrito)) return res.status(400).json({ error: 'Ubicación inválida.' });
      const envio = costoEnvio(e.tipo, e.provincia, e.canton, e.distrito);
      if (envio === null) return res.status(400).json({ error: 'Esa forma de entrega no está disponible para tu ubicación.' });
      if (e.tipo !== 'retiro' && e.senas.length < 10) return res.status(400).json({ error: 'Falta la dirección exacta.' });

      // 👕 Productos: precio y stock desde la BD
      if (!Array.isArray(items) || items.length === 0 || items.length > 30) return res.status(400).json({ error: 'El carrito está vacío.' });
      const ids = [...new Set(items.map((i) => String(i?.productId || '')))];
      if (ids.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ error: 'Producto inválido.' });
      const productos = await Product.find({ _id: { $in: ids } }).lean();
      const porId = new Map(productos.map((p) => [String(p._id), p]));
      // ⏳ Lo que tienen apartado OTROS carritos no se puede vender (lo de este carrito sí)
      const deOtros = await apartadas({ productIds: ids, excluirCarrito: carritoId || '__sin_carrito__' });

      const lineas = [];
      const pedidoPorTalla = new Map(); // productId|talla → cantidad total pedida (varias líneas con distinto dorsal)
      for (const i of items) {
        const p = porId.get(String(i.productId));
        const talla = txt(i.talla, 10);
        const cantidad = Math.trunc(Number(i.cantidad));
        if (!p || p.hidden) return res.status(409).json({ error: 'Una camiseta del carrito ya no está disponible.' });
        if (!talla || !Number.isFinite(cantidad) || cantidad < 1 || cantidad > 10) return res.status(400).json({ error: 'Cantidad inválida.' });
        const k = `${p._id}|${talla}`;
        pedidoPorTalla.set(k, (pedidoPorTalla.get(k) || 0) + cantidad);
        const otros = deOtros[String(p._id)]?.[talla] || 0;
        if (pedidoPorTalla.get(k) > stockDe(p, talla) - otros) {
          return res.status(409).json({
            error: otros > 0
              ? `"${p.name}" talla ${talla}: otro cliente la tiene apartada. Si no la compra, se libera en unos minutos.`
              : `Ya no hay suficientes "${p.name}" en talla ${talla}. Revisá el carrito.`,
          });
        }
        let dorsal;
        if (i.dorsal && p.isNumerable) {
          const nombre = txt(i.dorsal.name, 30);
          const numero = txt(i.dorsal.number, 5);
          const existe = (p.dorsalOptions || []).some(
            (o) => String(o.name || '').trim().toUpperCase() === nombre.toUpperCase() && String(o.number || '').trim() === numero && Number(o.quantity) > 0
          );
          if (!existe) return res.status(409).json({ error: `El dorsal ${nombre} #${numero} ya no está disponible.` });
          dorsal = { name: nombre, number: numero };
        }
        lineas.push({ productId: p._id, name: p.name, type: p.type, imageSrc: p.imageSrc, talla, dorsal, cantidad, precio: precioDe(p) });
      }

      const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
      const total = subtotal + envio;
      if (total <= 0) return res.status(400).json({ error: 'Total inválido.' });

      // 🧾 Orden pendiente
      const numero = await siguienteNumeroOrdenWeb();
      const orderNumber = `CSW${String(numero).padStart(6, '0')}`;
      const token = crypto.randomBytes(16).toString('hex');
      const orden = await OrdenWeb.create({
        numero, orderNumber, token, cliente: c,
        entrega: e.tipo === 'retiro' ? { tipo: 'retiro', provincia: e.provincia, canton: e.canton, distrito: e.distrito } : e,
        items: lineas, subtotal, envio, total, notas: txt(notas, 500),
        carritoId, facturaElectronica,
      });

      // ⏳ Mientras paga en Tilopay, las camisetas siguen apartadas (se amarran a la orden y se alargan)
      if (carritoId) {
        const hasta = new Date(Date.now() + MINUTOS_PAGO * 60 * 1000);
        for (const [k, cant] of pedidoPorTalla) {
          const [productId, talla] = k.split('|');
          await Reserva.updateOne(
            { carritoId, productId, talla },
            { $set: { cantidad: cant, expiresAt: hasta, orderNumber } },
            { upsert: true }
          );
        }
        await Reserva.deleteMany({ carritoId, orderNumber: { $ne: orderNumber } }); // lo que ya no está en el carrito
        await emitirApartadas(req.app.get('io'), ids);
      }

      // 💳 Link de pago (el cliente vuelve a /checkout/resultado con ?order=...&code=...)
      const url = await crearPago({
        orderNumber,
        amount: total,
        redirect: `${origenFront(req)}/checkout/resultado`,
        cliente: c,
        direccion: {
          linea1: e.tipo === 'retiro' ? 'Retiro en tienda' : e.senas.slice(0, 100),
          linea2: `${e.distrito}, ${e.canton}`,
          ciudad: e.canton,
          estadoISO: ISO_PROVINCIA[e.provincia] || 'CR-SJ',
        },
        returnData: Buffer.from(`${orderNumber}:${token}`).toString('base64'),
      });

      // token: solo lo recibe el navegador que creó la orden (respaldo si Tilopay no devuelve returnData)
      res.json({ url, orderNumber: orden.orderNumber, token, total });
    } catch (error) {
      console.error('❌ Error creando el pago:', error.message, error.data || '');
      res.status(502).json({ error: 'No pudimos conectar con la pasarela de pago. Probá de nuevo o pedí por WhatsApp.' });
    }
  }
);

/* ========================================================
   🔎 GET /api/checkout/orden/:orderNumber?t=TOKEN
   Lo llama /checkout/resultado al volver de Tilopay. Confirma el pago con consult
   (no con los parámetros de la URL) y marca la orden como pagada una sola vez.
   ======================================================== */
router.get(
  '/orden/:orderNumber',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 60, message: 'Demasiadas consultas. Probá en unos minutos.' }),
  async (req, res) => {
    try {
      const orderNumber = txt(req.params.orderNumber, 20);
      const token = txt(req.query.t, 64);
      const orden = await OrdenWeb.findOne({ orderNumber });
      if (!orden || !token || token.length !== orden.token.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(orden.token))) {
        return res.status(404).json({ error: 'Orden no encontrada.' });
      }

      // 💳 Confirma con Tilopay; si se acaba de pagar → rebaja stock y factura en Alegra (todo de una vez)
      const actual = (await confirmarPago(orden, req.app.get('io'))) || orden;
      Object.assign(orden, { estado: actual.estado, tilopay: actual.tilopay });

      res.json({
        orderNumber: orden.orderNumber,
        estado: orden.estado,
        total: orden.total,
        envio: orden.envio,
        entrega: orden.entrega?.tipo,
        envioTexto: orden.estado === 'pagada' ? textoEnvio(orden.entrega?.tipo, orden.pagadaAt || new Date(), new Date(), orden.entrega?.fechaEntrega) : '',
        nombre: orden.cliente?.nombre,
        correo: orden.cliente?.correo,
        items: orden.items.map((i) => ({ name: i.name, talla: i.talla, dorsal: i.dorsal, cantidad: i.cantidad, precio: i.precio })),
        motivo: orden.estado !== 'pagada' ? orden.tilopay?.description || '' : '',
      });
    } catch (error) {
      console.error('❌ Error verificando la orden:', error.message);
      res.status(500).json({ error: 'No pudimos verificar el pago. Recargá la página en un momento.' });
    }
  }
);

/* ========================================================
   👑 PANEL DE VENTAS WEB (solo súper usuario)
   ======================================================== */
const resumenOrden = (o) => ({
  _id: o._id,
  numero: o.numero,
  orderNumber: o.orderNumber,
  createdAt: o.createdAt,
  pagadaAt: o.pagadaAt,
  estado: o.estado,
  cliente: o.cliente,
  entrega: o.entrega,
  items: o.items,
  subtotal: o.subtotal,
  envio: o.envio,
  total: o.total,
  notas: o.notas,
  facturaElectronica: o.facturaElectronica !== false,
  tilopay: o.tilopay,
  stock: o.stock,
  factura: o.factura,
  guia: o.guia,
});

// GET /api/checkout/admin/ordenes?estado=pagada|pendiente|todas&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&q=texto
router.get('/admin/ordenes', requireVentasWeb, async (req, res) => {
  try {
    const { estado = 'pagada', desde, hasta, q } = req.query;
    const filtro = {};
    if (estado === 'pagada' || estado === 'pendiente' || estado === 'rechazada') filtro.estado = estado;
    const rango = {};
    // Fechas en hora de Costa Rica (UTC-6)
    if (/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) rango.$gte = new Date(`${desde}T00:00:00-06:00`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) rango.$lte = new Date(`${hasta}T23:59:59.999-06:00`);
    if (Object.keys(rango).length) filtro.createdAt = rango;
    const texto = txt(q, 60);
    if (texto) {
      const rx = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ orderNumber: rx }, { 'cliente.nombre': rx }, { 'cliente.apellidos': rx }, { 'cliente.cedula': rx }, { 'cliente.telefono': rx }, { 'cliente.correo': rx }];
    }
    const ordenes = await OrdenWeb.find(filtro).sort({ createdAt: -1 }).limit(300).lean();

    // Totales del rango (solo pagadas)
    // Pagos de prueba (Tilopay Test) no cuentan en los totales
    const pagadas = ordenes.filter((o) => o.estado === 'pagada' && String(o.tilopay?.environment || '').toLowerCase() !== 'test');
    const totales = {
      ordenes: pagadas.length,
      vendido: pagadas.reduce((s, o) => s + o.total, 0),
      envios: pagadas.reduce((s, o) => s + o.envio, 0),
      camisetas: pagadas.reduce((s, o) => s + o.items.reduce((a, i) => a + i.cantidad, 0), 0),
      pendientesFactura: pagadas.filter((o) => o.factura?.estado !== 'lista').length,
    };
    res.json({ ordenes: ordenes.map(resumenOrden), totales });
  } catch (error) {
    console.error('❌ Listando órdenes web:', error);
    res.status(500).json({ error: 'No se pudieron cargar las ventas web.' });
  }
});

// POST /api/checkout/admin/ordenes/:id/verificar → vuelve a preguntar a Tilopay (y completa stock/factura si faltaba)
router.post('/admin/ordenes/:id/verificar', requireVentasWeb, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    let orden = await OrdenWeb.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada.' });
    const io = req.app.get('io');
    if (orden.estado === 'pendiente') orden = await confirmarPago(orden, io);
    if (orden.estado === 'pagada' && !['listo', 'rebajando', 'omitido'].includes(orden.stock?.estado)) {
      if (orden.stock?.estado === 'error') await OrdenWeb.updateOne({ _id: orden._id }, { $unset: { 'stock.estado': 1 } });
      orden = (await rebajarStockOrden(orden._id, io)) || orden;
    }
    res.json(resumenOrden(await OrdenWeb.findById(orden._id).lean()));
  } catch (error) {
    console.error('❌ Verificando orden web:', error.message);
    res.status(502).json({ error: 'No se pudo consultar a Tilopay.' });
  }
});

// POST /api/checkout/admin/ordenes/:id/facturar → reintenta la factura en Alegra si falló
router.post('/admin/ordenes/:id/facturar', requireVentasWeb, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    const orden = await OrdenWeb.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada.' });
    if (orden.estado !== 'pagada') return res.status(400).json({ error: 'Solo se facturan órdenes pagadas.' });
    if (orden.factura?.estado === 'lista') return res.status(400).json({ error: 'Esta orden ya está facturada.' });
    // El panel puede facturar a mano también un pago de prueba (pide confirmación en pantalla)
    const tipo = req.body?.tipo === 'interno' ? 'interno' : 'hacienda';
    await facturarOrden(orden._id, { forzar: true, tipo });
    res.json(resumenOrden(await OrdenWeb.findById(orden._id).lean()));
  } catch (error) {
    console.error('❌ Refacturando orden web:', error.message);
    res.status(500).json({ error: 'No se pudo facturar.' });
  }
});

// 🗑️ DELETE /api/checkout/admin/ordenes/:id → borra la venta.
// Si ya se había rebajado stock, lo devuelve a la misma ubicación (con sus impresiones) y borra ese historial.
// ⚠️ La factura de Alegra NO se anula sola (es un documento ante Hacienda): se avisa para anularla allá.
router.delete('/admin/ordenes/:id', requireSuper, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    const orden = await OrdenWeb.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada.' });
    if (orden.stock?.estado === 'rebajando' || orden.factura?.estado === 'facturando') {
      return res.status(409).json({ error: 'La orden se está procesando, probá en un momento.' });
    }

    const io = req.app.get('io');
    const devoluciones = [];
    for (const m of orden.stock?.movimientos || []) {
      await ajustarStockPorUbicacion({
        productId: m.productId,
        talla: m.talla,
        ubicacion: m.ubicacion,
        cantidad: m.cantidad,
        delta: 1,
        dorsalesDevolver: m.dorsalesDescontados,
        io,
      });
      devoluciones.push(`${m.cantidad} talla ${m.talla} → ${m.ubicacion}`);
    }
    const historyIds = (orden.stock?.movimientos || []).map((m) => m.historyId).filter((id) => mongoose.isValidObjectId(id));
    if (historyIds.length) await History.deleteMany({ _id: { $in: historyIds } }).catch(() => {});

    await OrdenWeb.deleteOne({ _id: orden._id });
    console.log(`🗑️ Orden web ${orden.orderNumber} borrada por ${req.user?.name || '?'} · stock devuelto: ${devoluciones.join(', ') || 'nada'}`);
    res.json({
      ok: true,
      orderNumber: orden.orderNumber,
      devoluciones,
      facturaPendiente: orden.factura?.estado === 'lista' ? orden.factura.consecutivo || orden.factura.alegraId : '',
    });
  } catch (error) {
    console.error('❌ Borrando orden web:', error);
    res.status(500).json({ error: 'No se pudo borrar la venta.' });
  }
});

// POST /api/checkout/admin/ordenes/:id/guia { numero, tipo, pdfBase64?, enviarCorreo? }
// La guía se genera en el navegador con los mismos endpoints de /guias (POST /api/guias o /api/correos/generar-guia);
// acá se anota en la orden y, si es de Correos, se manda el PDF al correo que puso el cliente.
router.post('/admin/ordenes/:id/guia', requireVentasWeb, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    const orden = await OrdenWeb.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada.' });
    const numero = txt(req.body?.numero, 60);
    const tipo = ['Correos', 'Mensajero'].includes(req.body?.tipo) ? req.body.tipo : '';
    if (!numero || !tipo) return res.status(400).json({ error: 'Falta el número o el tipo de guía.' });

    const guia = { estado: 'lista', auto: false, error: '', tipo, numero, fecha: new Date(), por: req.user?.name || '', correoEnviado: false, correoError: '', datos: req.body?.datos || undefined };

    if (tipo === 'Correos' && req.body?.enviarCorreo) {
      const para = orden.cliente?.correo;
      const pdf = String(req.body?.pdfBase64 || '').replace(/^data:application\/pdf[^,]*,/, '');
      try {
        if (!para) throw new Error('La orden no tiene correo');
        if (!correoConfigurado()) throw new Error('El envío de correos no está configurado (SMTP)');
        const contenido = correoGuia({ nombre: orden.cliente?.nombre || '', orderNumber: orden.orderNumber, numeroGuia: numero, tipo });
        await enviarCorreo({
          para,
          asunto: contenido.asunto,
          texto: contenido.texto,
          html: contenido.html,
          adjuntos: pdf ? [{ filename: `Guia-${numero}.pdf`, content: Buffer.from(pdf, 'base64'), contentType: 'application/pdf' }] : [],
        });
        guia.correoEnviado = true;
      } catch (e) {
        console.warn(`⚠️ Guía ${numero} de ${orden.orderNumber}: no se pudo enviar el correo:`, e.message);
        guia.correoError = e.message;
      }
    }

    orden.guia = guia;
    await orden.save();
    res.json(resumenOrden(orden.toObject()));
  } catch (error) {
    console.error('❌ Guardando guía de orden web:', error.message);
    res.status(500).json({ error: 'No se pudo guardar la guía.' });
  }
});

// POST /api/checkout/admin/ordenes/:id/guia-auto → genera (o reintenta) la guía automática:
// Correos de CR o mensajero según lo que escogió el cliente, y se la manda por correo.
router.post('/admin/ordenes/:id/guia-auto', requireVentasWeb, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    const orden = await OrdenWeb.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada.' });
    if (orden.estado !== 'pagada') return res.status(400).json({ error: 'Solo órdenes pagadas.' });
    if (orden.entrega?.tipo === 'retiro') return res.status(400).json({ error: 'Retiro en tienda: no lleva guía.' });
    if (orden.guia?.numero) return res.status(400).json({ error: `Ya tiene la guía ${orden.guia.numero}.` });
    if (orden.guia?.estado === 'generando') return res.status(409).json({ error: 'La guía se está generando, probá en un momento.' });
    await generarGuiaOrden(orden._id, { forzar: true, por: req.user?.name || '' });
    res.json(resumenOrden(await OrdenWeb.findById(orden._id).lean()));
  } catch (error) {
    console.error('❌ Guía automática (panel):', error.message);
    res.status(500).json({ error: 'No se pudo generar la guía.' });
  }
});

export default router;
