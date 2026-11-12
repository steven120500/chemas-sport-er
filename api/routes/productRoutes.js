import express from 'express';
import Product from '../models/Product.js';
import History from '../models/History.js';
import cloudinary, { UPLOAD_LIMIT } from '../config/cloudinary.js';
import { productImageIds, destroyIfUnused } from '../utils/cloudinaryCleanup.js';
import multer from 'multer';

import { requireAuth, requireRole, canSeeHidden, escapeRegex } from '../middleware/auth.js';
import { emitProductUpdate } from '../utils/realtime.js';
import { leerImpresiones, rebajarEnOpciones, rebajarEnHermanos, devolverImpresiones, esMismaImpresion, cambiosManuales, sincronizarManualEnHermanos } from '../utils/dorsales.js';

const router = express.Router();

/* ======================= Multer (Memoria) ======================= */
const storage = multer.memoryStorage();
// Límites: evita que una subida gigante o con cientos de archivos tumbe el servidor
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024, files: 6 } });

/* =========================== Helpers ============================ */

const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const KID_SIZES   = ['16', '18', '20', '22', '24', '26', '28'];
const BALL_SIZES  = ['3', '4', '5']; 
const KEYCHAIN_SIZES = ['U'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES, ...BALL_SIZES, ...KEYCHAIN_SIZES]);

function whoDidIt(req) {
  return req.user?.name ||
         req.user?.email ||
         req.headers['x-user'] ||
         req.body.user ||
         'Sistema';
}

function diffInv(label, prev = {}, next = {}) {
  const sizes = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  const out = [];
  for (const size of sizes) {
    const a = Number(prev?.[size] ?? 0);
    const b = Number(next?.[size] ?? 0);
    if (a !== b) out.push(`${label}[${size}]: ${a} → ${b}`);
  }
  return out;
}

function diffProduct(prev, next) {
  const changes = [];
  if (prev.name !== next.name) changes.push(`nombre: "${prev.name}" → "${next.name}"`);
  if (prev.price !== next.price) changes.push(`precio: ${prev.price} → ${next.price}`);
  if (prev.discountPrice !== next.discountPrice)
    changes.push(`descuento: ${prev.discountPrice} → ${next.discountPrice}`);
  if (prev.type !== next.type) changes.push(`tipo: "${prev.type}" → "${next.type}"`);

  const prevMundial = Boolean(prev.isMundial2026);
  const nextMundial = Boolean(next.isMundial2026);

  if (prevMundial !== nextMundial) {
    changes.push(`Mundial 2026: ${prevMundial ? 'Sí' : 'No'} → ${nextMundial ? 'Sí' : 'No'}`);
  }

  const prevTemp = Boolean(prev.isTemporada2627);
  const nextTemp = Boolean(next.isTemporada2627);

  if (prevTemp !== nextTemp) {
    changes.push(`Temporada 26-27: ${prevTemp ? 'Sí' : 'No'} → ${nextTemp ? 'Sí' : 'No'}`);
  }

  const prevNum = Boolean(prev.isNumerable);
  const nextNum = Boolean(next.isNumerable);

  if (prevNum !== nextNum) {
    changes.push(`Numerable: ${prevNum ? 'Sí' : 'No'} → ${nextNum ? 'Sí' : 'No'}`);
  }

  if (prev.teamFont !== next.teamFont) {
    changes.push(`Tipografía: ${prev.teamFont} → ${next.teamFont}`);
  }

  changes.push(...diffInv('Tienda', prev.tienda, next.tienda));
  changes.push(...diffInv('Bodega 1', prev.stock, next.stock));
  changes.push(...diffInv('Bodega 2', prev.bodega, next.bodega));

  return changes;
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products', resource_type: 'image', ...UPLOAD_LIMIT },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function sanitizeInv(obj) {
  const clean = {};
  for (const [size, qty] of Object.entries(obj || {})) {
    if (!size) continue;
    const n = Math.max(0, Math.trunc(Number(qty) || 0));
    clean[String(size).trim()] = n;
  }
  return clean;
}

async function processDorsalOptions(rawOptions) {
  let list = rawOptions;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];

  const processed = await Promise.all(
    list.map(async (item) => {
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || '').trim();
      const number = String(item.number || '').trim();
      
      const quantity = Math.max(0, parseInt(item.quantity, 10) || 0);
      
      let imageUrl = String(item.imageUrl || '').trim();

      if (!name && !number) return null;

      if (imageUrl && imageUrl.startsWith('data:')) {
        try {
          const up = await cloudinary.uploader.upload(imageUrl, { folder: 'products/dorsales', resource_type: 'image', ...UPLOAD_LIMIT });
          imageUrl = up.secure_url;
        } catch (err) {
          console.error("Error subiendo imagen de dorsal a Cloudinary:", err);
        }
      }

      return { name, number, quantity, imageUrl };
    })
  );

  return processed.filter(Boolean);
}

/* ========================= Crear Producto ========================= */
router.post('/', requireRole('add'), upload.any(), async (req, res) => {
  try {
    const files = (req.files || []).filter(f =>
      f.fieldname === 'images' || f.fieldname === 'image'
    );

    if (!files.length) {
      return res.status(400).json({ error: 'No se enviaron imágenes' });
    }

    const uploaded = await Promise.all(files.map(f => uploadToCloudinary(f.buffer)));
    const images = uploaded.map(u => ({ public_id: u.public_id, url: u.secure_url }));
    const imageSrc = images[0]?.url || '';
    const imageSrc2 = images[1]?.url || ''; 

    let tienda = {};
    try {
      if (typeof req.body.tienda === 'string') tienda = JSON.parse(req.body.tienda);
      else if (typeof req.body.tienda === 'object') tienda = req.body.tienda;
    } catch { tienda = {}; }
    const cleanTienda = sanitizeInv(tienda);

    let stock = {};
    try {
      if (typeof req.body.stock === 'string') stock = JSON.parse(req.body.stock);
      else if (typeof req.body.sizes === 'string') stock = JSON.parse(req.body.sizes);
      else if (typeof req.body.stock === 'object') stock = req.body.stock;
    } catch { stock = {}; }
    const cleanStock = sanitizeInv(stock);

    let bodega = {};
    try {
      if (typeof req.body.bodega === 'string') bodega = JSON.parse(req.body.bodega);
      else if (typeof req.body.bodega === 'object') bodega = req.body.bodega;
    } catch { bodega = {}; }
    const cleanBodega = sanitizeInv(bodega);

    const isNumerable = req.body.isNumerable === 'true' || req.body.isNumerable === true;
    const dorsalOptions = isNumerable ? await processDorsalOptions(req.body.dorsalOptions) : [];

    const teamFont = req.body.teamFont || 'barca';

    const product = await Product.create({
      name: String(req.body.name || '').trim(),
      price: Number(req.body.price),
      discountPrice: Number(req.body.discountPrice) || 0,
      type: String(req.body.type || '').trim(),
      tienda: cleanTienda, 
      stock: cleanStock,
      bodega: cleanBodega,
      images,
      imageSrc,
      imageSrc2,
      hidden: req.body.hidden === 'true' || req.body.hidden === true,
      isMundial2026: req.body.isMundial2026 === 'true' || req.body.isMundial2026 === true,
      isTemporada2627: req.body.isTemporada2627 === 'true' || req.body.isTemporada2627 === true,
      isNumerable,
      dorsalOptions,
      teamFont 
    });

    await History.create({
      user: whoDidIt(req),
      action: 'creó producto',
      item: `${product.name} (${product.type})`,
      date: new Date(),
      details: `imagen: ${imageSrc} | descuento: ${product.discountPrice}`,
    });

    res.status(201).json(product);

  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

/* ==================== RUTAS DE BLOQUEO (CANDADO) ================== */

router.post('/:id/lock', requireRole('edit'), async (req, res) => {
  try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ error: "Producto no encontrado" });

      const user = whoDidIt(req);
      const now = new Date();

      if (product.lockedBy && product.lockedBy !== user) {
          const lockAge = now - product.lockedAt;
          if (lockAge < 600000) { 
              return res.status(409).json({ 
                  error: "Bloqueado", 
                  lockedBy: product.lockedBy 
              });
          }
      }

      product.lockedBy = user;
      product.lockedAt = now;
      await product.save();

      const freshProduct = await Product.findById(req.params.id).lean();
      res.json({ success: true, lockedBy: user, product: freshProduct });
  } catch (err) {
      console.error("Error en /lock:", err);
      res.status(500).json({ error: "Error al bloquear producto" });
  }
});

router.post('/:id/unlock', requireRole('edit'), async (req, res) => {
  try {
      const product = await Product.findById(req.params.id);
      const user = whoDidIt(req);

      if (product && product.lockedBy === user) {
          product.lockedBy = null;
          product.lockedAt = null;
          await product.save();
      }
      res.json({ success: true });
  } catch (err) {
      res.status(500).json({ error: "Error al desbloquear producto" });
  }
});

/* ======================== Actualizar Producto (CONTROL DE VENTAS) ====================== */
router.put('/:id', requireRole('edit'), async (req, res) => {
  try {
    const prev = await Product.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ error: 'Producto no encontrado' });

    const user = (req.body.sellerName || req.body.user || whoDidIt(req) || 'Sistema').trim();

    if (prev.lockedBy && prev.lockedBy !== user) {
      const lockAge = new Date() - prev.lockedAt;
      if (lockAge < 600000) {
        return res.status(409).json({ error: "Producto bloqueado por otro usuario", lockedBy: prev.lockedBy });
      }
    }

    let incomingTienda = req.body.tienda;
    if (typeof incomingTienda === 'string') {
      try { incomingTienda = JSON.parse(incomingTienda); } catch {}
    }
    const nextTienda = incomingTienda ? sanitizeInv(incomingTienda) : prev.tienda;

    let incomingStock = req.body.stock;
    if (typeof incomingStock === 'string') {
      try { incomingStock = JSON.parse(incomingStock); } catch {}
    }
    const nextStock = incomingStock ? sanitizeInv(incomingStock) : prev.stock;

    let incomingBodega = req.body.bodega;
    if (typeof incomingBodega === 'string') {
      try { incomingBodega = JSON.parse(incomingBodega); } catch {}
    }
    const nextBodega = incomingBodega ? sanitizeInv(incomingBodega) : prev.bodega;

    let restadas = 0;
    
    for (const size of new Set([...Object.keys(prev.tienda || {}), ...Object.keys(nextTienda || {})])) {
      const before = Number(prev.tienda?.[size] ?? 0);
      const after  = Number(nextTienda?.[size] ?? 0);
      if (before > after) restadas += (before - after);
    }
    
    for (const size of new Set([...Object.keys(prev.stock || {}), ...Object.keys(nextStock || {})])) {
      const before = Number(prev.stock?.[size] ?? 0);
      const after  = Number(nextStock?.[size] ?? 0);
      if (before > after) restadas += (before - after);
    }
    
    for (const size of new Set([...Object.keys(prev.bodega || {}), ...Object.keys(nextBodega || {})])) {
      const before = Number(prev.bodega?.[size] ?? 0);
      const after  = Number(nextBodega?.[size] ?? 0);
      if (before > after) restadas += (before - after);
    }

    const update = {
      name: req.body.name?.trim() || prev.name,
      type: req.body.type?.trim() || prev.type,
      price: Number.isFinite(Number(req.body.price)) ? Math.trunc(Number(req.body.price)) : prev.price,
      discountPrice: Number.isFinite(Number(req.body.discountPrice))
        ? Math.trunc(Number(req.body.discountPrice))
        : prev.discountPrice,
      tienda: nextTienda, 
      stock: nextStock,
      bodega: nextBodega,
      lockedBy: null,
      lockedAt: null
    };

    if (req.body.hidden !== undefined) update.hidden = req.body.hidden === 'true' || req.body.hidden === true;
    if (req.body.isMundial2026 !== undefined) update.isMundial2026 = req.body.isMundial2026 === 'true' || req.body.isMundial2026 === true;
    if (req.body.isTemporada2627 !== undefined) update.isTemporada2627 = req.body.isTemporada2627 === 'true' || req.body.isTemporada2627 === true;

    if (req.body.isNumerable !== undefined) {
      update.isNumerable = req.body.isNumerable === 'true' || req.body.isNumerable === true;
    }
    // ✍️ Cambios a mano en las impresiones: solo lo que se tocó en el editor (se copia luego al hermano Player/Fan)
    // ⚠️ Frontend viejo (manda purchasedDorsal, sin purchasedDorsals ni dorsalOptionsBase): él mismo ya rebajó la impresión vendida en dorsalOptions,
    // así que aquí no se rebaja otra vez ni se copian cambios manuales (evita rebajar doble mientras conviven versiones).
    const frontViejo = req.body.dorsalOptionsBase === undefined && req.body.purchasedDorsals === undefined;
    let cambiosDorsal = null;
    if (req.body.dorsalOptions !== undefined) {
      const enviadas = await processDorsalOptions(req.body.dorsalOptions);
      const r = cambiosManuales(enviadas, req.body.dorsalOptionsBase, prev.dorsalOptions || []);
      update.dorsalOptions = r.opciones;
      cambiosDorsal = frontViejo ? null : r.cambios;
    }
    if (req.body.teamFont !== undefined) {
      update.teamFont = req.body.teamFont;
    }

    let incomingImages = req.body.images;
    if (typeof incomingImages === 'string') {
      try { incomingImages = JSON.parse(incomingImages); } catch { incomingImages = undefined; }
    }

    if (Array.isArray(incomingImages)) {
      const prevList = prev.images || [];
      const processedImages = await Promise.all(
        incomingImages.map(async (raw) => {
          if (!raw) return null;
          const strVal = typeof raw === 'string' ? raw : (raw.url || raw.src || '');
          if (!strVal) return null;

          if (strVal.startsWith('data:')) {
            const up = await cloudinary.uploader.upload(strVal, { folder: 'products', resource_type: 'image', ...UPLOAD_LIMIT });
            return { public_id: up.public_id, url: up.secure_url };
          } else {
            const found = prevList.find(i => i.url === strVal);
            return found || { public_id: null, url: strVal };
          }
        })
      );
      const finalImages = processedImages.filter(Boolean);
      update.images = finalImages;
      update.imageSrc = finalImages[0]?.url || '';
      update.imageSrc2 = finalImages[1]?.url || ''; 
    }

    const nombreCliente = (req.body.customerName || "").trim();
    const esVenta = Boolean(req.body.isSale === true || req.body.isSale === 'true') && restadas > 0;
    const huboRebajaStock = restadas > 0;

    // 👕 1. IMPRESIONES: una por cada camiseta rebajada que lleva dorsal (ver utils/dorsales.js).
    // Se rebajan aquí (en este producto) y luego en su hermano Player/Fan. El frontend ya no las rebaja.
    const impresiones = huboRebajaStock ? leerImpresiones(req.body).slice(0, restadas) : [];
    let descontadosAqui = [];
    if (impresiones.length && frontViejo && Array.isArray(update.dorsalOptions)) {
      // Ya viene rebajada: solo anotamos lo que bajó de verdad (para devolverlo al anular)
      for (const imp of impresiones) {
        const antes = (prev.dorsalOptions || []).find((o) => esMismaImpresion(o, imp));
        const ahora = update.dorsalOptions.find((o) => esMismaImpresion(o, imp));
        if (antes && ahora && Number(antes.quantity) > Number(ahora.quantity)) {
          descontadosAqui.push({ name: ahora.name, number: ahora.number, qty: 1 });
        }
      }
    } else if (impresiones.length) {
      const base = Array.isArray(update.dorsalOptions)
        ? update.dorsalOptions
        : (prev.dorsalOptions || []).map((o) => ({ ...o }));
      update.dorsalOptions = base.map((o) => ({ ...o }));
      descontadosAqui = rebajarEnOpciones(update.dorsalOptions, impresiones);
    }
    const selectedDorsalText = impresiones.length
      ? ` | 👕 Dorsal Impreso: ${impresiones.map((d) => `${d.name.toUpperCase()} #${d.number}`).join(', ')}`
      : '';

    // Ahora sí guardamos el producto principal ya con su dorsal rebajado
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (esVenta) {
      updated.popularCountHistory.push({ date: new Date().toISOString(), quantity: restadas });
      const now = new Date();
      const totalMonth = (updated.popularCountHistory || [])
        .filter(entry => {
          const d = new Date(entry.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((sum, e) => sum + e.quantity, 0);
      updated.isPopular = totalMonth >= 10;
      await updated.save();
    }

    const io = req.app.get('io');

    // ✍️ Copiar al hermano Player <-> Fan lo cambiado a mano (antes de rebajar la venta, para que cuadren igual)
    const sincronizados = (updated.isNumerable && cambiosDorsal)
      ? await sincronizarManualEnHermanos(updated, cambiosDorsal, io)
      : [];
    const sincronizadosText = sincronizados.length
      ? ` | 🔁 Impresiones copiadas a: ${sincronizados.map((p) => `${p.name} (${p.type})`).join(', ')}`
      : '';

    // 👕 2. Rebajar las mismas impresiones en el hermano Player <-> Fan (mismo nombre) y emitir en vivo
    const descontados = [
      ...descontadosAqui.map((d) => ({ productId: String(updated._id), ...d })),
      ...(await rebajarEnHermanos(updated, impresiones, io)),
    ];

    const updatedObj = updated.toObject();

    // 🧹 Imágenes que tenía antes y ya no usa (foto reemplazada / dorsal cambiado):
    // se borran de Cloudinary en segundo plano, solo si nadie más las referencia.
    {
      const keep = productImageIds(updatedObj);
      const removed = [...productImageIds(prev)].filter((id) => !keep.has(id));
      // Seguro: si el producto quedó SIN fotos (casi seguro un error del cliente), no borramos nada:
      // en Cloudinary el borrado no se puede deshacer.
      const quedanFotos = (updatedObj.images || []).length > 0;
      if (removed.length && quedanFotos) destroyIfUnused(removed, { excludeProductId: prev._id }).catch(() => {});
    }
    const changes = diffProduct(prev, updatedObj);
    // ✍️ Impresiones cambiadas a mano (antes no quedaban en el historial)
    if (cambiosDorsal && updated.isNumerable) {
      const et = (o) => `${String(o.name || '').toUpperCase()} #${o.number}`;
      cambiosDorsal.cantidad.forEach((c) => changes.push(`Impresión ${et(c)} → ${c.quantity}`));
      cambiosDorsal.nuevas.forEach((c) => changes.push(`Impresión nueva ${et(c)}: ${Math.max(0, parseInt(c.quantity, 10) || 0)}`));
      cambiosDorsal.quitadas.forEach((c) => changes.push(`Impresión quitada ${et(c)}`));
    }
    
    const clienteFinal = nombreCliente && nombreCliente !== "No especificado" && nombreCliente !== "Ajuste de inventario"
      ? nombreCliente
      : (esVenta ? "Cliente General / Tienda" : "");

    let detalleText = '';
    
    if (esVenta && req.body.details) {
      detalleText = req.body.details.replace(/👤 Cliente:\s*[^|]+\|\s*/gi, "").trim();
    } else if (changes.length) {
      detalleText = changes.join(' | ');
    }

    if (detalleText || esVenta) {
      let accionTexto = esVenta ? 'vendió / rebajó stock' : (restadas > 0 ? 'ajustó stock' : 'actualizó producto');
      
      if (clienteFinal) {
        detalleText = `👤 Cliente: ${clienteFinal} | [ID:${prev._id}] | ${detalleText}`;
      } else {
        detalleText = `[ID:${prev._id}] | ${detalleText}`;
      }

      detalleText += selectedDorsalText + sincronizadosText;

      await History.create({
        user: user,
        action: accionTexto,
        item: `${updated.name} (${updated.type})`,
        date: new Date(),
        productId: String(prev._id),
        dorsalRefundData: impresiones.length
          ? {
              name: impresiones[0].name.toUpperCase(),
              number: impresiones[0].number,
              teamFont: updated.teamFont,
              impresiones,
              descontados,
            }
          : undefined,
        details: detalleText
      });
    }

    updatedObj._lastEditMeta = {
      user: user,
      customer: clienteFinal || nombreCliente,
      action: esVenta ? "rebajó stock" : "editó"
    };

    if (io) {
      emitProductUpdate(io, updatedObj);
    }

    // Enviamos al frontend el producto YA con el dorsal rebajado para que aparezca de inmediato sin F5
    res.status(200).json(updatedObj);

  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

/* ================== 🗑️ ANULAR VENTA Y DEVOLVER STOCK ================== */
router.post('/anular/:id', requireAuth, async (req, res) => {
  try {
    const { item, items } = req.body; 

    const historyEntry = await History.findById(req.params.id);

    if (!items || !Array.isArray(items) || items.length === 0) {
      if (historyEntry) await History.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: "Historial borrado (no se detectaron tallas)." });
    }

    let nameQuery = (item || "").trim();
    let typeQuery = null;

    const lastParen = nameQuery.lastIndexOf("(");
    if (lastParen !== -1) {
      typeQuery = nameQuery.substring(lastParen + 1, nameQuery.length - 1).trim(); 
      nameQuery = nameQuery.substring(0, lastParen).trim(); 
    }

    const escapedName = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    let queryExact = { name: new RegExp(`^${escapedName}$`, "i") };
    if (typeQuery) queryExact.type = new RegExp(`^${typeQuery}$`, "i");

    let product = await Product.findOne(queryExact);

    if (!product) {
      product = await Product.findOne({ name: new RegExp(escapedName, "i") });
    }

    if (!product) {
       if (historyEntry) await History.findByIdAndDelete(req.params.id);
       return res.json({ success: true, message: "Historial borrado (El producto original ya no existe)." });
    }

    const updatedTienda = { ...(product.tienda || {}) };
    const updatedStock = { ...(product.stock || {}) };
    const updatedBodega = { ...(product.bodega || {}) };

    items.forEach(({ tienda, talla }) => {
      if (talla) {
        const ubicacionLower = (tienda || "").toLowerCase();
        if (ubicacionLower === "tienda" || ubicacionLower.includes("tienda #1")) {
          updatedTienda[talla] = (Number(updatedTienda[talla]) || 0) + 1;
        } else if (ubicacionLower.includes("bodega 2") || ubicacionLower.includes("tienda #2")) {
          updatedBodega[talla] = (Number(updatedBodega[talla]) || 0) + 1;
        } else {
          updatedStock[talla] = (Number(updatedStock[talla]) || 0) + 1;
        }
      }
    });

    product.tienda = updatedTienda;
    product.stock = updatedStock;
    product.bodega = updatedBodega;
    product.markModified('tienda');
    product.markModified('stock');
    product.markModified('bodega');
    await product.save();

    const io = req.app.get('io');

    // 👕 Devolver las impresiones que se rebajaron (este producto y su hermano Player/Fan)
    await devolverImpresiones(historyEntry, product, io);

    if (historyEntry) await History.findByIdAndDelete(req.params.id);
    
    if (io) {
      emitProductUpdate(io, product.toObject());
    }

    res.json({ success: true, message: "Venta anulada, stock de camisa y dorsal devueltos correctamente." });
  } catch (error) {
    console.error("Error al anular venta:", error);
    res.status(500).json({ error: "Error interno al anular la venta" });
  }
});


/* ========================== Eliminar Producto ========================= */
router.delete('/:id', requireRole('delete'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const imageIds = [...productImageIds(product.toObject())];
    await product.deleteOne();
    // 🧹 Fotos + imágenes de dorsales (solo las que ningún otro producto/factura use)
    await destroyIfUnused(imageIds, { excludeProductId: product._id });

    await History.create({
      user: whoDidIt(req),
      action: 'eliminó producto',
      item: `${product.name} (${product.type})`,
      date: new Date(),
      details: `imagenes borradas: ${(product.images || []).length}`,
    });

    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

/* =============================== GET LIST ============================== */
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '21', 10), 1), 100);
    const q     = (req.query.q || '').trim();
    const type  = (req.query.type || '').trim();
    const sizes = (req.query.sizes || '').trim();
    const storeView = (req.query.storeView || '').trim(); 
    const sortParam = req.query.sort; 

    const find = {};
    // Los ocultos solo los ve quien tiene sesión con permiso (antes bastaba el header x-admin)
    if (!canSeeHidden(req.user)) find.hidden = { $ne: true };

    if (q) find.name = { $regex: escapeRegex(q), $options: 'i' };

    if (type === 'Ofertas') {
      find.discountPrice = { $gt: 0 };
      find.$expr = { $lt: ['$discountPrice', '$price'] };
    } else if (type === 'Populares') {
      find.isPopular = true;
    } else if (type === 'Mundial 2026') {
      find.isMundial2026 = true;
    } else if (type === 'Temp 26-27' || type === 'Temporada 26-27') {
      find.$or = [{ isTemporada2627: true }, { type: { $regex: '26-27', $options: 'i' } }];
    } else if (type) {
      find.type = type;
    }

    const allSizesArray = Array.from(ALL_SIZES);
    const sizesArr = sizes ? sizes.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (storeView === 'tienda') {
      const checkSizes = sizesArr.length > 0 ? sizesArr : allSizesArray;
      find.$or = checkSizes.map(size => ({ [`tienda.${size}`]: { $gt: 0 } }));
    } else if (storeView === 'bodega1' || storeView === 'tienda1') {
      const checkSizes = sizesArr.length > 0 ? sizesArr : allSizesArray;
      find.$or = checkSizes.map(size => ({ [`stock.${size}`]: { $gt: 0 } }));
    } else if (storeView === 'bodega2' || storeView === 'tienda2') {
      const checkSizes = sizesArr.length > 0 ? sizesArr : allSizesArray;
      find.$or = checkSizes.map(size => ({ [`bodega.${size}`]: { $gt: 0 } }));
    } else if (sizesArr.length > 0) {
      find.$or = sizesArr.flatMap(size => ([
        { [`tienda.${size}`]: { $gt: 0 } },
        { [`stock.${size}`]: { $gt: 0 } },
        { [`bodega.${size}`]: { $gt: 0 } },
      ]));
    }

    const projection = 'name price discountPrice type imageSrc images tienda stock bodega createdAt isPopular hidden popularCountHistory isMundial2026 isTemporada2627 isNumerable teamFont dorsalOptions lockedBy';
    const sortOptions = sortParam === 'desc' ? { _id: -1 } : { name: 1 };

    const [items, total] = await Promise.all([
      Product.find(find).select(projection).sort(sortOptions).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(find),
    ]);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });

  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

/* ================= OBTENER UN PRODUCTO POR ID DIRECTO ================= */
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product || (product.hidden && !canSeeHidden(req.user))) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

export default router;