// api/routes/productRoutes.js
import express from 'express';
import Product from '../models/Product.js';
import History from '../models/History.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

const router = express.Router();

/* ================= Multer (buffer en memoria, solo para POST) ================= */
const storage = multer.memoryStorage();
const upload  = multer({ storage });

/* ================= Helpers ================= */

// Tallas permitidas
const ADULT_SIZES = ['S','M','L','XL','XXL','3XL','4XL'];
const KID_SIZES   = ['16','18','20','22','24','26','28'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES]);

// Quién hizo el cambio
function whoDidIt(req) {
  return req.user?.name || req.user?.email || req.headers['x-user'] || req.body.user || 'Sistema';
}

// Dif de stock/bodega (para historial)
function diffInv(label, prev = {}, next = {}) {
  const sizes = new Set([...(Object.keys(prev||{})), ...(Object.keys(next||{}))]);
  const out = [];
  for (const s of sizes) {
    const a = Number(prev?.[s] ?? 0);
    const b = Number(next?.[s] ?? 0);
    if (a !== b) out.push(`${label}[${s}]: ${a} -> ${b}`);
  }
  return out;
}

// Diferencias legibles de producto (para historial)
function diffProduct(prev, next) {
  const ch = [];
  if (prev.name  !== next.name)  ch.push(`nombre: "${prev.name}" -> "${next.name}"`);
  if (prev.price !== next.price) ch.push(`precio: ${prev.price} -> ${next.price}`);
  if (prev.type  !== next.type)  ch.push(`tipo: "${prev.type}" -> "${next.type}"`);
  ch.push(...diffInv('stock',  prev.stock,  next.stock));
  ch.push(...diffInv('bodega', prev.bodega, next.bodega));
  return ch;
}

// Sube 1 buffer a Cloudinary
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Sanitiza inventario (stock/bodega)
function sanitizeInv(obj) {
  const clean = {};
  for (const [size, qty] of Object.entries(obj || {})) {
    if (!ALL_SIZES.has(String(size))) continue;
    const n = Math.max(0, Math.trunc(Number(qty) || 0));
    clean[size] = n;
  }
  return clean;
}

/* ================= Rutas ================= */

/** Crear producto */
router.post('/', upload.any(), async (req, res) => {
  try {
    const files = (req.files || []).filter(f =>
      f.fieldname === 'images' || f.fieldname === 'image'
    );
    if (!files.length) {
      return res.status(400).json({ error: 'No se enviaron imágenes' });
    }

    const uploaded = await Promise.all(files.map(f => uploadToCloudinary(f.buffer)));
    const images   = uploaded.map(u => ({ public_id: u.public_id, url: u.secure_url }));
    const imageSrc = images[0]?.url || '';

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

    const product = await Product.create({
      name : String(req.body.name || '').trim(),
      price: Number(req.body.price),
      type : String(req.body.type || '').trim(),
      stock: cleanStock,
      bodega: cleanBodega,
      imageSrc,
      images,
    });

    try {
      await History.create({
        user:  whoDidIt(req),
        action:'creó producto',
        item:  `${product.name} (${product.type})`,
        date:  new Date(),
        details: `img principal: ${imageSrc}`,
      });
    } catch (e) {
      console.warn('No se pudo guardar historial (create):', e.message);
    }

    res.status(201).json(product);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: err.message || 'Error al crear producto' });
  }
});

/** Actualizar producto */
router.put('/:id', async (req, res) => {
  try {
    const prev = await Product.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ error: 'Producto no encontrado' });

    let incomingStock = req.body.stock;
    if (typeof incomingStock === 'string') {
      try { incomingStock = JSON.parse(incomingStock); } catch { incomingStock = undefined; }
    }
    let nextStock = prev.stock;
    if (incomingStock && typeof incomingStock === 'object') {
      nextStock = sanitizeInv(incomingStock);
    }

    let incomingBodega = req.body.bodega;
    if (typeof incomingBodega === 'string') {
      try { incomingBodega = JSON.parse(incomingBodega); } catch { incomingBodega = undefined; }
    }
    let nextBodega = prev.bodega || {};
    if (incomingBodega && typeof incomingBodega === 'object') {
      nextBodega = sanitizeInv(incomingBodega);
    }

    const update = {
      name : typeof req.body.name  === 'string' ? req.body.name.trim().slice(0,150) : prev.name,
      type : typeof req.body.type  === 'string' ? req.body.type.trim().slice(0,40)  : prev.type,
      price: Number.isFinite(Number(req.body.price)) ? Math.trunc(Number(req.body.price)) : prev.price,
      stock: nextStock,
      bodega: nextBodega,
    };

    if (req.body.imageSrc  !== undefined) update.imageSrc  = req.body.imageSrc  || '';
    if (req.body.imageSrc2 !== undefined) update.imageSrc2 = req.body.imageSrc2 || '';
    if (req.body.imageAlt  !== undefined) update.imageAlt  = req.body.imageAlt  || '';

    let incomingImages = req.body.images;
    if (typeof incomingImages === 'string') {
      try { incomingImages = JSON.parse(incomingImages); } catch { incomingImages = undefined; }
    }

    if (Array.isArray(incomingImages)) {
      const prevList = prev.images || [];
      const normalized = [];
      for (const raw of incomingImages.slice(0, 2)) {
        if (!raw) continue;
        if (typeof raw === 'string' && raw.startsWith('data:')) {
          const up = await cloudinary.uploader.upload(raw, { folder: 'products', resource_type: 'image' });
          normalized.push({ public_id: up.public_id, url: up.secure_url });
        } else if (typeof raw === 'string') {
          const found = prevList.find(i => i.url === raw);
          if (found) normalized.push({ public_id: found.public_id || null, url: found.url });
          else       normalized.push({ public_id: null, url: raw });
        } else if (raw && typeof raw === 'object' && raw.url) {
          normalized.push({ public_id: raw.public_id || null, url: raw.url });
        }
      }
      const keepUrls = new Set(normalized.map(i => i.url));
      for (const old of prevList) {
        if (old.public_id && !keepUrls.has(old.url)) {
          try { await cloudinary.uploader.destroy(old.public_id); } catch {}
        }
      }
      update.images    = normalized;
      update.imageSrc  = normalized[0]?.url || '';
      update.imageSrc2 = normalized[1]?.url || '';
    } else {
      if (req.body.imageSrc !== undefined || req.body.imageSrc2 !== undefined) {
        const imgs = [update.imageSrc, update.imageSrc2]
          .filter(Boolean)
          .map(url => ({ url, public_id: (prev.images || []).find(i => i.url === url)?.public_id || null }));
        update.images = imgs;
      }
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    const changes = diffProduct(prev, updated.toObject());
    if (changes.length) {
      try {
        await History.create({
          user:  whoDidIt(req),
          action:'actualizó producto',
          item:  `${updated.name} (${updated.type})`,
          date:  new Date(),
          details: changes.join(' | '),
        });
      } catch (e) {
        console.warn('No se pudo guardar historial (update):', e.message);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

/** Eliminar producto */
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    for (const img of product.images || []) {
      if (img.public_id) {
        try { await cloudinary.uploader.destroy(img.public_id); } catch {}
      }
    }

    await product.deleteOne();

    try {
      await History.create({
        user:  whoDidIt(req),
        action:'eliminó producto',
        item:  `${product.name} (${product.type})`,
        date:  new Date(),
        details: `imagenes borradas: ${product.images?.length || 0}`,
      });
    } catch (e) {
      console.warn('No se pudo guardar historial (delete):', e.message);
    }

    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

/** Salud */
router.get('/health', async (_req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ ok: true, count });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/** Listado paginado con filtros */
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const q     = (req.query.q || '').trim();
    const type  = (req.query.type || '').trim();
    const sizes = (req.query.sizes || '').trim();

    const find = {};
    if (q) find.name = { $regex: q, $options: 'i' };
    if (type) find.type = type;

    // ⬇️ Nuevo: filtro por tallas
    if (sizes) {
      const arr = sizes.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) {
        find.$or = arr.map(size => ({
          [`stock.${size}`]: { $gt: 0 }
        }));
      }
    }

    const projection = 'name price type imageSrc images stock bodega createdAt';

    const [items, total] = await Promise.all([
      Product.find(find)
        .select(projection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(find),
    ]);

    res.set('Cache-Control', 'public, max-age=20');

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

export default router;
