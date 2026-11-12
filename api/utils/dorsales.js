// utils/dorsales.js
// 👕 Impresiones (dorsales) de camisetas numerables.
// Una camiseta Player y su Fan tienen el MISMO nombre (ej. "FC Barcelona Local 26-27 Lisa") y comparten
// el inventario de impresiones: al vender una impresión se rebaja en las dos, y al anular se devuelve en las dos.
// Se guarda exactamente qué se rebajó (History.dorsalRefundData.descontados) para devolver lo mismo al anular.
import Product from '../models/Product.js';
import { emitProductUpdate } from './realtime.js';

/** "  Fermín " → "FERMIN" (sin tildes, mayúsculas, espacios simples) */
export const normDorsal = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

/** ¿Esta opción de dorsal es la impresión pedida? (nombre + número; si no hay nombre, solo número) */
export function esMismaImpresion(opt, imp) {
  const n = normDorsal(imp?.name);
  const num = normDorsal(imp?.number);
  if (!n && !num) return false;
  if (n && normDorsal(opt?.name) !== n) return false;
  if (num && normDorsal(opt?.number) !== num) return false;
  return true;
}

/** Lee la lista de impresiones vendidas del body (nuevo: purchasedDorsals[], viejo: purchasedDorsal) */
export function leerImpresiones(body) {
  const parse = (v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return null; }
  };
  let lista = parse(body?.purchasedDorsals);
  if (!Array.isArray(lista)) {
    const una = parse(body?.purchasedDorsal);
    lista = una ? [una] : [];
  }
  return lista
    .map((d) => ({ name: String(d?.name ?? '').trim().slice(0, 60), number: String(d?.number ?? '').trim().slice(0, 10) }))
    .filter((d) => d.name || d.number);
}

/** Productos hermanos (mismo nombre, numerables), sin incluir el actual */
export async function hermanosDe(product) {
  const nombre = normDorsal(product?.name);
  if (!nombre) return [];
  const numerables = await Product.find({ _id: { $ne: product._id }, isNumerable: true });
  return numerables.filter((p) => normDorsal(p.name) === nombre);
}

/**
 * Rebaja 1 por cada impresión en una lista de dorsalOptions (objetos planos). Solo si queda > 0.
 * Devuelve [{ name, number, qty }] con lo que sí se rebajó.
 */
export function rebajarEnOpciones(opciones, impresiones) {
  const hechos = [];
  for (const imp of impresiones) {
    const opt = (opciones || []).find((o) => esMismaImpresion(o, imp) && Number(o.quantity) > 0);
    if (!opt) continue;
    opt.quantity = Number(opt.quantity) - 1;
    const prev = hechos.find((h) => esMismaImpresion({ name: h.name, number: h.number }, opt));
    if (prev) prev.qty += 1;
    else hechos.push({ name: opt.name, number: opt.number, qty: 1 });
  }
  return hechos;
}

/** Rebaja las impresiones en los hermanos (Player ↔ Fan) y emite cada cambio en vivo */
export async function rebajarEnHermanos(product, impresiones, io) {
  const descontados = [];
  if (!impresiones.length) return descontados;
  for (const prod of await hermanosDe(product)) {
    const opciones = (prod.dorsalOptions || []).map((o) => (o.toObject ? o.toObject() : { ...o }));
    const hechos = rebajarEnOpciones(opciones, impresiones);
    if (!hechos.length) continue;
    prod.dorsalOptions = opciones;
    prod.markModified('dorsalOptions');
    await prod.save();
    if (io) emitProductUpdate(io, prod.toObject());
    hechos.forEach((h) => descontados.push({ productId: String(prod._id), ...h }));
  }
  return descontados;
}

/** Impresiones escritas en el texto viejo del historial: "Dorsal Impreso: FERMÍN #7, GORDON #17" */
function impresionesDelTexto(details) {
  const txt = typeof details === 'string' ? details : '';
  const m = txt.match(/Dorsal Impreso:\s*([^|\n]+)/i);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim().match(/^(.*?)\s*#\s*(\S*)$/))
    .filter(Boolean)
    .map(([, name, number]) => ({ name: name.trim(), number: number.trim() }))
    .filter((d) => d.name || d.number);
}

/**
 * ↩️ Al anular una venta: devuelve las impresiones que se rebajaron.
 * - Ventas nuevas: devuelve exactamente lo guardado en dorsalRefundData.descontados.
 * - Ventas viejas (sin ese dato): +1 por cada impresión del texto, en el producto y sus hermanos.
 * Devuelve cuántas impresiones se devolvieron.
 */
export async function devolverImpresiones(historyEntry, product, io) {
  const data = historyEntry?.dorsalRefundData || null;
  const descontados = Array.isArray(data?.descontados) ? data.descontados : null;

  // Agrupar por producto: { productId: [{ name, number, qty }] }
  const porProducto = new Map();
  const agregar = (id, imp, qty) => {
    if (!id || qty <= 0) return;
    const k = String(id);
    if (!porProducto.has(k)) porProducto.set(k, []);
    porProducto.get(k).push({ ...imp, qty });
  };

  if (descontados) {
    descontados.forEach((d) => agregar(d.productId, { name: d.name, number: d.number }, Number(d.qty) || 0));
  } else {
    let impresiones = impresionesDelTexto(historyEntry?.details);
    if (!impresiones.length && (data?.name || data?.number)) impresiones = [{ name: data.name, number: data.number }];
    if (!impresiones.length || !product) return 0;
    const familia = [product, ...(await hermanosDe(product))];
    for (const p of familia) impresiones.forEach((imp) => agregar(p._id, imp, 1));
  }

  let devueltas = 0;
  for (const [id, imps] of porProducto) {
    const prod = await Product.findById(id);
    if (!prod) continue;
    const opciones = (prod.dorsalOptions || []).map((o) => (o.toObject ? o.toObject() : { ...o }));
    let cambio = false;
    for (const imp of imps) {
      const opt = opciones.find((o) => esMismaImpresion(o, imp));
      if (!opt) continue; // la impresión ya no existe en ese producto
      opt.quantity = (Number(opt.quantity) || 0) + imp.qty;
      devueltas += imp.qty;
      cambio = true;
    }
    if (!cambio) continue;
    prod.dorsalOptions = opciones;
    prod.markModified('dorsalOptions');
    await prod.save();
    if (io) emitProductUpdate(io, prod.toObject());
  }
  return devueltas;
}

/* ================== ✍️ EDICIÓN MANUAL DE IMPRESIONES (Player ↔ Fan) ================== */
const claveImp = (o) => `${normDorsal(o?.name)}|${normDorsal(o?.number)}`;
const parseLista = (v) => {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  return Array.isArray(v) ? v : null;
};

/**
 * Qué cambió a mano en el editor: compara lo que el editor cargó (base) con lo que mandó.
 * Si el frontend no manda la base (versión vieja), se compara contra lo guardado.
 * Devuelve { cambios: { cantidad: [{name, number, quantity}], nuevas: [opt], quitadas: [{name, number}] }, opciones }
 * - `opciones`: la lista a guardar en ESTE producto. Las impresiones que no se tocaron conservan la cantidad
 *   actual de la base de datos (así un editor abierto hace rato no pisa ventas que pasaron mientras tanto).
 */
export function cambiosManuales(enviadas, baseRaw, guardadas) {
  const base = (parseLista(baseRaw) || guardadas || []).filter((o) => o && (o.name || o.number));
  const actual = new Map((guardadas || []).map((o) => [claveImp(o), o]));
  const enBase = new Map(base.map((o) => [claveImp(o), o]));
  const enviadasKeys = new Set();
  const cambios = { cantidad: [], nuevas: [], quitadas: [] };

  const opciones = (enviadas || []).map((o) => {
    const k = claveImp(o);
    enviadasKeys.add(k);
    const b = enBase.get(k);
    if (!b) {
      cambios.nuevas.push({ ...o });
      return o;
    }
    const qty = Math.max(0, parseInt(o.quantity, 10) || 0);
    const qtyBase = Math.max(0, parseInt(b.quantity, 10) || 0);
    if (qty !== qtyBase) {
      cambios.cantidad.push({ name: o.name, number: o.number, quantity: qty });
      return o;
    }
    // No la tocaron: se queda con la cantidad que hay ahora en la base de datos
    const hoy = actual.get(k);
    return hoy ? { ...o, quantity: Math.max(0, Number(hoy.quantity) || 0) } : o;
  });

  for (const [k, b] of enBase) {
    if (!enviadasKeys.has(k)) cambios.quitadas.push({ name: b.name, number: b.number });
  }
  return { cambios, opciones };
}

const hayCambios = (c) => c && (c.cantidad.length || c.nuevas.length || c.quitadas.length);

/**
 * Copia a los hermanos (Player ↔ Fan) lo que se cambió a mano: misma cantidad, impresiones nuevas y quitadas.
 * Devuelve la lista de productos actualizados [{ _id, name, type }].
 */
export async function sincronizarManualEnHermanos(product, cambios, io) {
  const hechos = [];
  if (!hayCambios(cambios) || !product?.isNumerable) return hechos;
  for (const prod of await hermanosDe(product)) {
    let opciones = (prod.dorsalOptions || []).map((o) => (o.toObject ? o.toObject() : { ...o }));
    const antes = JSON.stringify(opciones);

    const quitar = new Set(cambios.quitadas.map(claveImp));
    opciones = opciones.filter((o) => !quitar.has(claveImp(o)));

    for (const c of cambios.cantidad) {
      const opt = opciones.find((o) => claveImp(o) === claveImp(c));
      if (opt) opt.quantity = c.quantity;
      else opciones.push({ name: c.name, number: c.number, quantity: c.quantity, imageUrl: '' });
    }
    for (const n of cambios.nuevas) {
      const opt = opciones.find((o) => claveImp(o) === claveImp(n));
      if (opt) opt.quantity = Math.max(0, parseInt(n.quantity, 10) || 0);
      else opciones.push({ name: n.name, number: n.number, quantity: Math.max(0, parseInt(n.quantity, 10) || 0), imageUrl: n.imageUrl || '' });
    }

    if (JSON.stringify(opciones) === antes) continue;
    prod.dorsalOptions = opciones;
    prod.markModified('dorsalOptions');
    await prod.save();
    if (io) emitProductUpdate(io, prod.toObject());
    hechos.push({ _id: String(prod._id), name: prod.name, type: prod.type });
  }
  return hechos;
}
