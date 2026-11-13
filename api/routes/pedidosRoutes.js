// routes/pedidosRoutes.js
// 🧾 Pedidos por encargo. Todo exige sesión (empleados y súper usuarios); borrar, solo súper usuario.
// Cerrar la semana y marcar que llegó: súper usuario o los usuarios de PEDIDOS_CIERRE_USUARIOS (por defecto Johanna).
// Revisión: el empleado registra (Nuevo) → Johanna lo manda a confirmar (Por confirmar) → el empleado que lo registró
// confirma con el cliente (Confirmado) → al cerrar la semana solo entran los Confirmado.
import express from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Pedido, {
  ESTADOS_PEDIDO, ESTADOS_ENTREGA, ESTADOS_SEMANA, METODOS_PAGO, METODOS_ABONO, ENTREGAS, MANGAS, fotosDeItems,
  siguienteNumeroPedido, siguienteNumeroLote, PedidoLote, pagadoDe, saldoDe,
} from '../models/Pedido.js';
import Product from '../models/Product.js';
import { requireAuth, escapeRegex } from '../middleware/auth.js';
import { fechaCR, fotosDeProducto, cldTransform } from '../utils/pedidosUtils.js';
import cloudinary, { UPLOAD_LIMIT, publicIdFromUrl } from '../config/cloudinary.js';
import { destroyIfUnused } from '../utils/cloudinaryCleanup.js';

const router = express.Router();
router.use(requireAuth);

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const entero = (v) => {
  const n = Math.trunc(Number(String(v ?? '').replace(/[^\d.-]/g, '')));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const sinTildes = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** ¿Puede cerrar la semana / marcar que llegó? Súper usuario, rol "cerrar_pedidos" o usuario de la lista */
function puedeCerrar(user) {
  if (!user?.id) return false;
  if (user.isSuperUser || (user.roles || []).includes('cerrar_pedidos')) return true;
  const lista = (process.env.PEDIDOS_CIERRE_USUARIOS || 'johanna,johana').split(',').map(sinTildes).filter(Boolean);
  return lista.includes(sinTildes(user.name));
}
/** ¿Es quien registró el pedido? (es quien habla con el cliente) */
const esQuienRegistro = (pedido, user) => Boolean(user?.id && pedido?.registradoPorId && String(pedido.registradoPorId) === String(user.id));
const conSaldo = (p) => ({ ...p, pagado: pagadoDe(p), saldo: saldoDe(p) });
const colonesTxt = (n) => `₡${Number(n || 0).toLocaleString('de-DE')}`;

function requireCierre(req, res, next) {
  if (puedeCerrar(req.user)) return next();
  return res.status(403).json({ error: 'Solo el súper admin o Johanna pueden cerrar el pedido semanal.' });
}

const precioEfectivo = (p) => (p?.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p?.price || 0);

/* ---------- Filtros (lista y Excel usan los mismos) ---------- */
function construirFiltro(query) {
  const f = {};
  const estado = str(query.estado, 40);
  if (estado && ESTADOS_PEDIDO.includes(estado)) f.estado = estado;
  else if (estado === 'Pendientes') f.estado = { $in: ['Llegó', 'Avisado'] }; // llegaron y falta entregar
  else if (estado === 'Semana') f.estado = { $in: ESTADOS_SEMANA }; // semana en curso (por revisar / por confirmar / confirmados)

  const lote = str(query.lote, 40);
  if (mongoose.isValidObjectId(lote)) f.lote = new mongoose.Types.ObjectId(lote);

  const desde = str(query.desde, 10);
  const hasta = str(query.hasta, 10);
  if (YMD_RX.test(desde) || YMD_RX.test(hasta)) {
    f.fechaYMD = {};
    if (YMD_RX.test(desde)) f.fechaYMD.$gte = desde;
    if (YMD_RX.test(hasta)) f.fechaYMD.$lte = hasta;
  }

  const q = str(query.q, 80);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const or = [
      { 'cliente.nombre': rx }, { 'cliente.telefono': rx }, { 'items.equipo': rx },
      { 'items.nombre': rx }, { registradoPor: rx }, { notas: rx }, { 'guia.numero': rx },
    ];
    const num = parseInt(q.replace(/^#/, ''), 10);
    if (/^#?\d+$/.test(q) && Number.isFinite(num)) or.push({ numero: num });
    f.$or = or;
  }
  return f;
}

/* ---------- Limpia y completa las camisetas que manda el formulario ---------- */
async function prepararItems(itemsIn, itemsPrevios = []) {
  if (!Array.isArray(itemsIn) || !itemsIn.length) throw Object.assign(new Error('Agregá al menos una camiseta.'), { status: 400 });
  if (itemsIn.length > 50) throw Object.assign(new Error('Máximo 50 camisetas por pedido.'), { status: 400 });

  const ids = [...new Set(itemsIn.map((it) => it?.producto).filter((id) => mongoose.isValidObjectId(id)))];
  const productos = ids.length ? await Product.find({ _id: { $in: ids } }, 'name price discountPrice type images imageSrc imageSrc2').lean() : [];
  const porId = new Map(productos.map((p) => [String(p._id), p]));
  const previos = new Map(itemsPrevios.map((it) => [String(it._id), it]));

  // 1) Validar todo primero (para no subir fotos de un pedido que igual va a fallar)
  const base = itemsIn.map((it, i) => {
    const prod = porId.get(String(it?.producto || ''));
    const previo = it?._id ? previos.get(String(it._id)) : null;
    const equipo = str(it?.equipo, 150) || prod?.name || '';
    const talla = str(it?.talla, 40);
    if (!equipo) throw Object.assign(new Error(`Camiseta ${i + 1}: falta el equipo / producto.`), { status: 400 });
    if (!talla) throw Object.assign(new Error(`Camiseta ${i + 1}: falta la talla.`), { status: 400 });

    // 📸 Fotos que manda el formulario (máx. 2): nuevas (data:image) o las que ya tenía este pedido.
    // Si no manda la lista (versión vieja), se conserva lo de antes / se copian del catálogo.
    let fotosIn = null;
    if (Array.isArray(it?.fotos)) {
      const yaTenia = new Set(previo?.fotos || []);
      fotosIn = it.fotos
        .filter((f) => typeof f === 'string' && (f.startsWith('data:image/') ? f.length <= MAX_FOTO : yaTenia.has(f)))
        .slice(0, 2);
    }

    // 📸 Foto del parche (opcional, 1): nueva (data:image), la que ya tenía, o '' para quitarla
    let fotoParcheIn = previo?.fotoParche || '';
    if (it?.fotoParche !== undefined) {
      const f = it.fotoParche;
      fotoParcheIn = typeof f === 'string' && (f.startsWith('data:image/') ? f.length <= MAX_FOTO : f && f === previo?.fotoParche) ? f : '';
    }

    const precioIn = it?.precio;
    const precio = precioIn === '' || precioIn == null ? precioEfectivo(prod) : entero(precioIn);

    return {
      fotosIn,
      fotoParcheIn,
      prod,
      previo,
      item: {
        ...(previo ? { _id: previo._id } : {}),
        producto: prod?._id || null,
        equipo,
        version: str(it?.version, 40) || prod?.type || '',
        talla,
        nombre: str(it?.nombre, 40).toUpperCase(),
        dorsal: str(it?.dorsal, 10),
        parche: str(it?.parche, 120),
        manga: MANGAS.includes(it?.manga) ? it.manga : 'Corta',
        cantidad: Math.min(99, Math.max(1, entero(it?.cantidad) || 1)),
        precio,
        costoProveedor: Math.max(0, Number(it?.costoProveedor) || 0),
      },
    };
  });

  // 2) Subir a Cloudinary las fotos nuevas (carpeta products/pedidos: la cubre el reporte de huérfanas)
  const subir = async (f) => {
    try {
      const up = await cloudinary.uploader.upload(f, { folder: 'products/pedidos', resource_type: 'image', ...UPLOAD_LIMIT });
      return up.secure_url;
    } catch (err) {
      console.error('Pedidos: error subiendo foto a Cloudinary:', err?.message || err);
      throw Object.assign(new Error('No se pudo subir la foto. Probá de nuevo.'), { status: 502 });
    }
  };
  const out = [];
  for (const b of base) {
    let fotos = [];
    if (b.fotosIn) {
      for (const f of b.fotosIn) {
        fotos.push(f.startsWith('data:') ? await subir(f) : f);
      }
    } else if (b.previo && String(b.previo.producto || '') === String(b.prod?._id || '') && b.previo.fotos?.length) {
      fotos = b.previo.fotos;
    } else if (b.prod) {
      fotos = fotosDeProducto(b.prod);
    }
    const fotoParche = b.fotoParcheIn.startsWith('data:') ? await subir(b.fotoParcheIn) : b.fotoParcheIn;
    out.push({ ...b.item, fotos, fotoParche });
  }
  return out;
}

const MAX_FOTO = 8 * 1024 * 1024; // data URL de una foto (el navegador ya la achica a ~1000px)

/** 🧹 Borra de Cloudinary las fotos que ya nadie usa (las del catálogo nunca, porque las usa el producto) */
function borrarFotosSinUso(urls) {
  const ids = [...new Set((urls || []).map(publicIdFromUrl).filter(Boolean))];
  if (ids.length) destroyIfUnused(ids).catch(() => {});
}

function datosGenerales(body) {
  const c = body?.cliente || {};
  const nombre = str(c.nombre, 120);
  if (!nombre) throw Object.assign(new Error('Falta el nombre del cliente.'), { status: 400 });
  const entrega = ENTREGAS.includes(c.entrega) ? c.entrega : 'Correos de CR';
  const metodoPago = METODOS_PAGO.includes(body?.metodoPago) ? body.metodoPago : '';
  return {
    cliente: { nombre, telefono: str(c.telefono, 30), entrega, direccion: str(c.direccion, 400) },
    adelanto: entero(body?.adelanto),
    metodoPago,
    notas: str(body?.notas, 1000),
  };
}

const enviarError = (res, err, msg) => {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  if (err?.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Datos inválidos' });
  console.error(msg, err);
  return res.status(500).json({ error: msg });
};

/* ================= LISTA ================= */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10) || 25, 1), 100);
    const filtro = construirFiltro(req.query);

    // Conteo por estado con los mismos filtros de fecha/búsqueda (para las pestañas)
    const { estado: _e, ...sinEstado } = filtro;
    const [pedidos, total, conteo] = await Promise.all([
      Pedido.find(filtro).sort({ numero: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Pedido.countDocuments(filtro),
      Pedido.aggregate([{ $match: sinEstado }, { $group: { _id: '$estado', n: { $sum: 1 } } }]),
    ]);
    const conteos = Object.fromEntries(conteo.map((c) => [c._id, c.n]));
    res.json({
      pedidos: pedidos.map(conSaldo),
      total, page, pages: Math.max(1, Math.ceil(total / limit)), conteos,
    });
  } catch (err) {
    enviarError(res, err, 'Error al cargar los pedidos');
  }
});

/* ================= EXPORTAR A EXCEL ================= */
// Mismas columnas que la hoja del admin (Image, Team, Size, Versión, Number, Name, Patches, Quantity, Client, Pago, Pendiente…)
// Como la hoja de Johanna: manga larga → "M LONG SLEEVE" con la talla en amarillo;
// Fan con nombre/número → número y nombre en amarillo; parche con foto → la foto en la columna Patches.
const tallaHoja = (it) => (it.manga === 'Larga' ? `${it.talla} LONG SLEEVE` : it.talla);
const resaltarDorsal = (it) => /fan/i.test(it.version || '') && Boolean(it.nombre || it.dorsal);
const AMARILLO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

async function bajarMiniatura(url, trans = 'c_fill,w_120,h_138') {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(cldTransform(url, `f_jpg,q_auto:eco,${trans}`), { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

router.get('/exportar', async (req, res) => {
  try {
    const pedidos = await Pedido.find(construirFiltro(req.query)).sort({ numero: 1 }).limit(2000).lean();
    const conFotos = req.query.fotos !== '0';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ChemaSport ER';
    const ws = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Image', key: 'img', width: 13 },
      { header: 'Team', key: 'equipo', width: 30 },
      { header: 'Size', key: 'talla', width: 12 },
      { header: 'Versión', key: 'version', width: 10 },
      { header: 'Number', key: 'dorsal', width: 9 },
      { header: 'Name', key: 'nombre', width: 14 },
      { header: 'Patches', key: 'parche', width: 30 },
      { header: 'Quantity', key: 'cantidad', width: 9 },
      { header: 'Client', key: 'cliente', width: 26 },
      { header: 'Pago', key: 'pago', width: 10 },
      { header: 'Pendiente', key: 'pendiente', width: 11 },
      { header: 'Notas', key: 'notas', width: 24 },
      { header: 'Price', key: 'costo', width: 8 },
      { header: 'Colaborador', key: 'colab', width: 14 },
      { header: 'Avisado', key: 'avisado', width: 9 },
      { header: 'Guia', key: 'guia', width: 18 },
      { header: 'Pedido #', key: 'numero', width: 9 },
      { header: 'Semana', key: 'semana', width: 9 },
      { header: 'Fecha', key: 'fecha', width: 11 },
      { header: 'Teléfono', key: 'tel', width: 13 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Precio cliente', key: 'precio', width: 13 },
    ];
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    head.alignment = { vertical: 'middle', horizontal: 'center' };
    head.height = 22;

    const filasConFoto = [];
    for (const p of pedidos) {
      const saldo = saldoDe(p);
      const pagado = pagadoDe(p); // adelanto + abonos
      p.items.forEach((it, idx) => {
        const primera = idx === 0; // Pago / Pendiente / notas solo en la 1ra fila del pedido (para no sumarlos doble)
        const row = ws.addRow({
          equipo: it.equipo,
          talla: tallaHoja(it),
          version: it.version,
          dorsal: it.dorsal ? (/^\d+$/.test(it.dorsal) ? Number(it.dorsal) : it.dorsal) : 'N/A',
          nombre: it.nombre || 'N/A',
          parche: it.parche || (it.fotoParche ? '' : 'N/A'),
          cantidad: it.cantidad,
          cliente: p.cliente?.nombre,
          pago: primera ? pagado : null,
          pendiente: primera ? saldo : null,
          notas: primera ? p.notas : '',
          costo: it.costoProveedor || null,
          colab: p.registradoPor,
          avisado: ['Avisado', 'Completado'].includes(p.estado) ? 'SI' : '',
          semana: p.loteNumero || '',
          guia: p.guia?.numero || '',
          numero: p.numero,
          fecha: p.fechaYMD,
          tel: p.cliente?.telefono,
          estado: p.estado,
          precio: it.precio * it.cantidad,
        });
        row.alignment = { vertical: 'middle', wrapText: true };
        ['talla', 'version', 'dorsal', 'nombre'].forEach((k) => {
          const c = row.getCell(k);
          c.font = { bold: true };
          c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        if (it.manga === 'Larga') row.getCell('talla').fill = AMARILLO;
        if (resaltarDorsal(it)) { row.getCell('dorsal').fill = AMARILLO; row.getCell('nombre').fill = AMARILLO; }
        if (conFotos && it.fotos?.[0]) filasConFoto.push({ row: row.number, col: 0, url: it.fotos[0] });
        if (conFotos && it.fotoParche) filasConFoto.push({ row: row.number, col: 6, url: it.fotoParche, parche: true });
        if (conFotos && (it.fotos?.[0] || it.fotoParche)) row.height = 78;
        if (conFotos && it.fotoParche && it.parche) row.getCell('parche').alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
      });
    }
    ['pago', 'pendiente', 'precio'].forEach((k) => { ws.getColumn(k).numFmt = '"₡"#,##0'; });

    // 👥 Solo súper admin: tabla a la par con cuántas camisetas encargó cada colaborador
    if (req.user.isSuperUser && pedidos.length) {
      const porColab = new Map();
      for (const p of pedidos) {
        const nombre = (p.registradoPor || '—').trim() || '—';
        const key = sinTildes(nombre);
        const acc = porColab.get(key) || { nombre, pedidos: 0, camisetas: 0 };
        acc.pedidos += 1;
        acc.camisetas += p.items.reduce((a, it) => a + (Number(it.cantidad) || 1), 0);
        porColab.set(key, acc);
      }
      const filas = [...porColab.values()].sort((a, b) => b.camisetas - a.camisetas || a.nombre.localeCompare(b.nombre));
      const c0 = ws.columns.length + 2; // una columna vacía de separación
      ws.getColumn(c0).width = 18;
      ws.getColumn(c0 + 1).width = 10;
      ws.getColumn(c0 + 2).width = 11;
      const pintar = (rowNum, valores, estilo) => {
        valores.forEach((v, i) => {
          const c = ws.getRow(rowNum).getCell(c0 + i);
          c.value = v;
          c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
          c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
          if (estilo) Object.assign(c, estilo);
        });
      };
      const negro = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } } };
      pintar(1, ['Colaborador', 'Pedidos', 'Camisetas'], negro);
      filas.forEach((f, i) => pintar(i + 2, [f.nombre, f.pedidos, f.camisetas]));
      pintar(filas.length + 2, ['TOTAL', filas.reduce((a, f) => a + f.pedidos, 0), filas.reduce((a, f) => a + f.camisetas, 0)], {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } },
      });
    }

    // Miniaturas (de 6 en 6 para no saturar)
    for (let i = 0; i < filasConFoto.length; i += 6) {
      const lote = filasConFoto.slice(i, i + 6);
      const bufs = await Promise.all(lote.map((f) => bajarMiniatura(f.url, f.parche ? 'c_pad,b_white,w_300,h_140' : undefined)));
      lote.forEach((f, j) => {
        const celda = ws.getRow(f.row).getCell(f.col + 1);
        if (!bufs[j]) {
          if (!celda.value) celda.value = { text: f.parche ? 'ver parche' : 'ver foto', hyperlink: f.url };
          return;
        }
        const imageId = wb.addImage({ buffer: bufs[j], extension: 'jpeg' });
        // parche: foto ancha (puede traer varios parches juntos); si también hay texto, queda abajo de la foto
        const ext = f.parche ? { width: 150, height: 70 } : { width: 88, height: 100 };
        ws.addImage(imageId, { tl: { col: f.col + 0.1, row: f.row - 1 + 0.05 }, ext });
      });
    }

    const { fechaYMD } = fechaCR();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pedidos-${fechaYMD}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) enviarError(res, err, 'Error al exportar los pedidos');
    else res.end();
  }
});

/* ================= PERMISOS DEL USUARIO ================= */
router.get('/permisos', (req, res) =>
  res.json({ puedeCerrar: puedeCerrar(req.user), isSuperUser: !!req.user.isSuperUser, id: String(req.user.id || ''), nombre: req.user.name || '' })
);

/* ================= PEDIDOS SEMANALES (lotes) ================= */
router.get('/lotes', async (_req, res) => {
  try {
    const [lotes, stats, abiertos] = await Promise.all([
      PedidoLote.find().sort({ numero: -1 }).limit(60).lean(),
      Pedido.aggregate([
        { $match: { lote: { $ne: null } } },
        {
          $group: {
            _id: '$lote',
            clientes: { $sum: 1 },
            camisetas: { $sum: { $sum: '$items.cantidad' } },
            avisados: { $sum: { $cond: [{ $eq: ['$estado', 'Avisado'] }, 1, 0] } },
            completados: { $sum: { $cond: [{ $eq: ['$estado', 'Completado'] }, 1, 0] } },
          },
        },
      ]),
      Pedido.aggregate([
        { $match: { estado: 'Confirmado' } }, // lo que entraría si se cierra hoy
        { $group: { _id: null, clientes: { $sum: 1 }, camisetas: { $sum: { $sum: '$items.cantidad' } } } },
      ]),
    ]);
    const porLote = new Map(stats.map((s) => [String(s._id), s]));
    res.json({
      semanaActual: { clientes: abiertos[0]?.clientes || 0, camisetas: abiertos[0]?.camisetas || 0 },
      lotes: lotes.map((l) => {
        const s = porLote.get(String(l._id)) || {};
        return { ...l, clientes: s.clientes || 0, camisetas: s.camisetas || 0, avisados: s.avisados || 0, completados: s.completados || 0 };
      }),
    });
  } catch (err) {
    enviarError(res, err, 'Error al cargar los pedidos semanales');
  }
});

// 🔒 Cerrar la semana: los pedidos "Confirmado" pasan al pedido semanal #N y ya no se editan.
// Los que siguen por revisar / por confirmar se quedan para el próximo pedido.
router.post('/lotes/cerrar', requireCierre, async (req, res) => {
  try {
    const ids = (await Pedido.find({ estado: 'Confirmado' }, '_id').lean()).map((p) => p._id);
    if (!ids.length) return res.status(400).json({ error: 'No hay pedidos confirmados por el cliente para cerrar esta semana.' });

    const { fechaYMD, fecha } = fechaCR();
    const lote = await PedidoLote.create({ numero: await siguienteNumeroLote(), fechaYMD, fecha, cerradoPor: req.user.name });
    // Solo los que siguen en "Confirmado" (por si alguien lo devolvió/borró en el mismo segundo)
    const r = await Pedido.updateMany(
      { _id: { $in: ids }, estado: 'Confirmado' },
      { $set: { estado: 'Pedido', lote: lote._id, loteNumero: lote.numero }, $push: { historialEstados: { estado: 'Pedido', por: req.user.name, fecha: new Date() } } }
    );
    // Dos cierres en el mismo segundo (ej. Johanna y el súper admin): el que llegó tarde no se lleva ninguno → se deshace
    if (!r.modifiedCount) {
      await PedidoLote.deleteOne({ _id: lote._id });
      return res.status(409).json({ error: 'Esta semana ya la acaba de cerrar otra persona.' });
    }
    res.status(201).json({ lote, pedidos: r.modifiedCount });
  } catch (err) {
    enviarError(res, err, 'Error al cerrar el pedido semanal');
  }
});

router.get('/lotes/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido semanal no encontrado' });
    const lote = await PedidoLote.findById(req.params.id).lean();
    if (!lote) return res.status(404).json({ error: 'Pedido semanal no encontrado' });
    const pedidos = await Pedido.find({ lote: lote._id }).sort({ numero: 1 }).lean();
    res.json({ lote, pedidos: pedidos.map(conSaldo) });
  } catch (err) {
    enviarError(res, err, 'Error al cargar el pedido semanal');
  }
});

// 📦 Llegó el pedido semanal: sus pedidos quedan listos para avisar al cliente
router.put('/lotes/:id/llego', requireCierre, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido semanal no encontrado' });
    const lote = await PedidoLote.findById(req.params.id);
    if (!lote) return res.status(404).json({ error: 'Pedido semanal no encontrado' });
    if (lote.estado !== 'Llegó') {
      lote.estado = 'Llegó';
      lote.llegoAt = new Date();
      lote.llegoPor = req.user.name;
      await lote.save();
      await Pedido.updateMany(
        { lote: lote._id, estado: 'Pedido' },
        { $set: { estado: 'Llegó' }, $push: { historialEstados: { estado: 'Llegó', por: req.user.name, fecha: new Date() } } }
      );
    }
    res.json(lote);
  } catch (err) {
    enviarError(res, err, 'Error al marcar que llegó');
  }
});

/* ================= DETALLE ================= */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
    const p = await Pedido.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(p);
  } catch (err) {
    enviarError(res, err, 'Error al cargar el pedido');
  }
});

/* ================= CREAR ================= */
router.post('/', async (req, res) => {
  try {
    const generales = datosGenerales(req.body);
    const items = await prepararItems(req.body?.items);
    const por = req.user.name;
    const { fechaYMD, fecha } = fechaCR();

    const pedido = new Pedido({
      ...generales,
      items,
      numero: await siguienteNumeroPedido(),
      fechaYMD, fecha,
      estado: 'Nuevo',
      historialEstados: [{ estado: 'Nuevo', por, fecha: new Date() }],
      registradoPor: por,
      registradoPorId: req.user.id,
    });
    await pedido.save();

    res.status(201).json(pedido);
  } catch (err) {
    enviarError(res, err, 'Error al guardar el pedido');
  }
});

/* ================= EDITAR ================= */
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!ESTADOS_SEMANA.includes(pedido.estado)) return res.status(409).json({ error: 'Este pedido ya se le pidió al proveedor: no se puede editar.' });

    // ✏️ Quién edita: por revisar / por confirmar → quien lo registró o Johanna; confirmado → solo Johanna / súper
    const jefa = puedeCerrar(req.user);
    const dueno = esQuienRegistro(pedido, req.user);
    if (pedido.estado === 'Confirmado' && !jefa) return res.status(403).json({ error: 'El pedido ya está confirmado: solo Johanna o el súper admin lo pueden editar.' });
    if (!jefa && !dueno) return res.status(403).json({ error: 'Solo quien registró el pedido o Johanna lo pueden editar.' });
    const estadoAntes = pedido.estado;
    // Si el empleado lo cambia cuando ya estaba por confirmar, Johanna lo tiene que volver a revisar
    const estadoNuevo = estadoAntes === 'Por confirmar' && !jefa ? 'Nuevo' : estadoAntes;

    const generales = datosGenerales(req.body);
    const fotosAntes = fotosDeItems(pedido.items);
    const items = await prepararItems(req.body?.items, pedido.items.map((i) => i.toObject()));
    pedido.set({ ...generales, items });
    await pedido.validate();
    // Guardar solo si sigue en el mismo estado (si cerraron la semana o lo movieron mientras se editaba, no se toca)
    const cambios = { $set: { cliente: pedido.cliente, adelanto: pedido.adelanto, metodoPago: pedido.metodoPago, notas: pedido.notas, items: pedido.items, total: pedido.total, estado: estadoNuevo } };
    cambios.$push = { historialEstados: { estado: estadoNuevo !== estadoAntes ? 'Nuevo' : 'Editado', por: req.user.name, fecha: new Date() } };
    const guardado = await Pedido.findOneAndUpdate({ _id: pedido._id, estado: estadoAntes }, cambios, { new: true });
    if (!guardado) {
      // las fotos nuevas que se subieron para esta edición ya no se usan
      const viejas = new Set(fotosAntes);
      borrarFotosSinUso(fotosDeItems(items).filter((u) => !viejas.has(u)));
      return res.status(409).json({ error: 'El pedido cambió de estado mientras lo editabas. Abrilo otra vez.' });
    }
    const quedan = new Set(fotosDeItems(items));
    borrarFotosSinUso(fotosAntes.filter((u) => !quedan.has(u)));
    res.json(guardado);
  } catch (err) {
    enviarError(res, err, 'Error al actualizar el pedido');
  }
});

/* ================= CAMBIAR ESTADO ================= */
// Revisión (semana en curso):
//   Nuevo → Por confirmar          Johanna / súper (ya lo revisó)
//   Por confirmar → Confirmado     quien lo registró o Johanna (el cliente confirmó la imagen)
//   Por confirmar / Confirmado → Nuevo   Johanna / súper (devolver a revisión)
const PASOS_REVISION = {
  'Por confirmar': { desde: ['Nuevo'], quien: 'jefa' },
  Confirmado: { desde: ['Por confirmar'], quien: 'dueno' },
  Nuevo: { desde: ['Por confirmar', 'Confirmado'], quien: 'jefa' },
};

router.put('/:id/estado', async (req, res) => {
  try {
    const estado = str(req.body?.estado, 40);
    if (!ESTADOS_ENTREGA.includes(estado) && !PASOS_REVISION[estado]) return res.status(400).json({ error: 'Estado inválido' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const paso = PASOS_REVISION[estado];
    if (paso) {
      if (pedido.estado === estado) return res.json(pedido);
      if (!paso.desde.includes(pedido.estado)) return res.status(409).json({ error: `El pedido está "${pedido.estado}": no se puede pasar a "${estado}".` });
      const jefa = puedeCerrar(req.user);
      if (paso.quien === 'jefa' && !jefa) return res.status(403).json({ error: 'Solo Johanna o el súper admin pueden hacer esto.' });
      if (paso.quien === 'dueno' && !jefa && !esQuienRegistro(pedido, req.user)) {
        return res.status(403).json({ error: `Lo confirma quien registró el pedido (${pedido.registradoPor || '—'}) o Johanna.` });
      }
      // Atómico: si alguien cerró la semana o lo movió en el mismo momento, no se pisa
      const r = await Pedido.findOneAndUpdate(
        { _id: pedido._id, estado: pedido.estado },
        { $set: { estado }, $push: { historialEstados: { estado, por: req.user.name, fecha: new Date() } } },
        { new: true }
      );
      if (!r) return res.status(409).json({ error: 'El pedido acaba de cambiar. Recargá la página.' });
      return res.json(r);
    }

    // Avisado / Completado solo después de que llegó el pedido semanal
    if (!ESTADOS_ENTREGA.includes(pedido.estado)) {
      return res.status(409).json({ error: 'El pedido todavía no ha llegado.' });
    }
    if (pedido.estado !== estado) {
      pedido.estado = estado;
      pedido.cerradoAt = estado === 'Completado' ? new Date() : null;
      if (estado === 'Avisado') pedido.avisado = { fecha: new Date(), por: req.user.name };
      if (estado === 'Llegó') pedido.avisado = { fecha: null, por: '' };
      pedido.historialEstados.push({ estado, por: req.user.name, fecha: new Date() });
      await pedido.save();
    }
    res.json(pedido);
  } catch (err) {
    enviarError(res, err, 'Error al cambiar el estado');
  }
});

/* ================= ABONOS ================= */
// 💵 El cliente abona después del adelanto (ej. ₡10.000 una semana antes de que llegue): baja el saldo pendiente.
// Cualquier empleado con sesión lo puede registrar (cualquiera puede recibir el SINPE).
router.post('/:id/abonos', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
    const monto = entero(req.body?.monto);
    if (!monto) return res.status(400).json({ error: 'Poné el monto del abono.' });
    const metodo = METODOS_ABONO.includes(req.body?.metodo) ? req.body.metodo : '';
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const saldo = saldoDe(pedido);
    if (saldo <= 0) return res.status(409).json({ error: 'Este pedido ya está pagado por completo.' });
    if (monto > saldo) return res.status(400).json({ error: `El abono es mayor a lo que debe (${colonesTxt(saldo)}).` });

    const abono = { monto, metodo, nota: str(req.body?.nota, 200), fecha: new Date(), por: req.user.name, porId: String(req.user.id || '') };
    // $push atómico (dos empleados abonando al mismo tiempo no se pisan)
    const r = await Pedido.findByIdAndUpdate(
      pedido._id,
      {
        $push: {
          abonos: abono,
          historialEstados: { estado: `Abono ${colonesTxt(monto)}${metodo ? ` (${metodo})` : ''}`, por: req.user.name, fecha: new Date() },
        },
      },
      { new: true, runValidators: true }
    );
    res.status(201).json(r);
  } catch (err) {
    enviarError(res, err, 'Error al registrar el abono');
  }
});

// Quitar un abono (por error): quien lo registró, Johanna o el súper admin
router.delete('/:id/abonos/:abonoId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.abonoId)) return res.status(404).json({ error: 'Abono no encontrado' });
    const pedido = await Pedido.findById(req.params.id);
    const abono = pedido?.abonos?.id(req.params.abonoId);
    if (!abono) return res.status(404).json({ error: 'Abono no encontrado' });
    if (!puedeCerrar(req.user) && String(abono.porId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Solo quien registró el abono o Johanna lo pueden quitar.' });
    }
    const r = await Pedido.findByIdAndUpdate(
      pedido._id,
      {
        $pull: { abonos: { _id: abono._id } },
        $push: { historialEstados: { estado: `Abono quitado ${colonesTxt(abono.monto)}`, por: req.user.name, fecha: new Date() } },
      },
      { new: true }
    );
    res.json(r);
  } catch (err) {
    enviarError(res, err, 'Error al quitar el abono');
  }
});

/* ================= GUÍA DE ENVÍO ================= */
// La guía se genera en la pantalla (Correos o mensajero, igual que en /guias) y aquí solo se anota en el pedido.
router.put('/:id/guia', async (req, res) => {
  try {
    const numero = str(req.body?.numero, 60);
    const tipo = ['Correos', 'Mensajero'].includes(req.body?.tipo) ? req.body.tipo : '';
    if (!numero || !tipo) return res.status(400).json({ error: 'Falta el número o el tipo de guía.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!ESTADOS_ENTREGA.includes(pedido.estado)) return res.status(409).json({ error: 'El pedido todavía no ha llegado.' });

    pedido.guia = { numero, tipo, fecha: new Date(), por: req.user.name };
    pedido.historialEstados.push({ estado: `Guía ${tipo} ${numero}`, por: req.user.name, fecha: new Date() });
    await pedido.save();
    res.json(pedido);
  } catch (err) {
    enviarError(res, err, 'Error al guardar la guía');
  }
});

/* ================= ELIMINAR =================
   🗑️ Súper usuario: cualquier pedido.
   👤 Colaborador: solo SUS pedidos y solo al principio ("Nuevo" / por revisar, sin semana),
      p. ej. si lo metió mal o el cliente al final no lo va a pedir. */
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!req.user.isSuperUser) {
      if (!esQuienRegistro(pedido, req.user)) {
        return res.status(403).json({ error: 'Solo podés eliminar pedidos que registraste vos.' });
      }
      if (pedido.estado !== 'Nuevo' || pedido.lote) {
        return res.status(403).json({ error: 'Solo se puede eliminar mientras está "Por revisar". Pedile al súper admin.' });
      }
    }
    const r = await Pedido.findByIdAndDelete(pedido._id);
    if (!r) return res.status(404).json({ error: 'Pedido no encontrado' });
    borrarFotosSinUso(fotosDeItems(r.items));
    res.json({ ok: true });
  } catch (err) {
    enviarError(res, err, 'Error al eliminar el pedido');
  }
});

export default router;
