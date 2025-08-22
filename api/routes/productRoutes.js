// api/routes/productRoutes.js
import express from 'express';
import multer from 'multer';
import Product from '../models/Product.js';
import History from '../models/History.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

/* ================== Multer (buffers en memoria) ================== */
const upload = multer({ storage: multer.memoryStorage() });

console.log('[productRoutes] cargando');

/* ================== Helpers / Constantes ================== */
const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const KID_SIZES   = ['16', '18', '20', '22', '24', '26', '28'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES]);

const whoDidIt = (req) =>
  req.user?.name ||
  req.user?.email ||
  req.headers['x-user'] ||
  req.body.user ||
  'Sistema';

const diffStock = (prev = {}, next = {}) => {
  const sizes = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  const out = [];
  for (const s of sizes) {
    const a = Number(prev?.[s] ?? 0);
    const b = Number(next?.[s] ?? 0);
    if (a !== b) out.push(`stock[${s}]: ${a} -> ${b}`);
  }
  return out;
};

const diffProduct = (prev, next) => {
  const ch = [];
  if (prev.name !== next.name) ch.push(`nombre: "${prev.name}" -> "${next.name}"`);
  if (prev.price !== next.price) ch.push(`precio: ${prev.price} -> ${next.price}`);
  if (prev.type !== next.type) ch.push(`tipo: "${prev.type}" -> "${next.type}"`);
  ch.push(...diffStock(prev.stock, next.stock));
  return ch;
};

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

/* ================== Rutas ================== */

/** GET /api/products?Page&limit&q&type  (listado paginado + filtros) */
// Listado paginado de productos
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(),
    ]);

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
/** GET /api/products/health  (ping rápido + conteo) */
router.get('/health', async (_req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ ok: true, count });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/** POST /api/products  (crear; sube múltiples imágenes) */
router.post('/', upload.any(), async (req, res) => {
  try {
    // acepta 'images' o 'image'
    const files = (req.files || []).filter(f =>
      f.fieldname === 'images' || f.fieldname === 'image'
    );
    if (!files.length) {
      return res.status(400).json({ error: 'No se enviaron imágenes' });
    }

    const uploaded = await Promise.all(files.map(f => uploadToCloudinary(f.buffer)));
    const images = uploaded.map(u => ({ public_id: u.public_id, url: u.secure_url }));
    const imageSrc = images[0]?.url || '';

    // stock puede venir string JSON o objeto
    let stock = {};
    try {
      if (typeof req.body.stock === 'string') stock = JSON.parse(req.body.stock);
      else if (typeof req.body.sizes === 'string') stock = JSON.parse(req.body.sizes);
      else if (typeof req.body.stock === 'object') stock = req.body.stock;
    } catch { stock = {}; }

    const cleanStock = {};
    for (const [size, qty] of Object.entries(stock || {})) {
      if (!ALL_SIZES.has(String(size))) continue;
      const n = Math.max(0, Math.trunc(Number(qty) || 0));
      cleanStock[size] = n;
    }

    const product = await Product.create({
      name:  String(req.body.name || '').trim(),
      price: Math.trunc(Number(req.body.price) || 0),
      type:  String(req.body.type || '').trim(),
      stock: cleanStock,
      imageSrc,
      images,
    });

    // historial (best-effort)
    try {
      await History.create({
        user:  whoDidIt(req),
        action:'creó producto',
        item:  `${product.name} (#${product._id})`,
        date:  new Date(),
        details: `img principal: ${imageSrc}`,
      });
    } catch (e) {
      console.warn('Historial create falló:', e.message);
    }

    res.status(201).json(product);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: err.message || 'Error al crear producto' });
  }
});

/** PUT /api/products/:id  (actualiza campos básicos e imagenes referenciadas) */
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
      const clean = {};
      for (const [size, qty] of Object.entries(incomingStock)) {
        if (!ALL_SIZES.has(String(size))) continue;
        const n = Math.max(0, Math.trunc(Number(qty) || 0));
        clean[size] = n;
      }
      nextStock = clean;
    }

    const update = {
      name:  typeof req.body.name  === 'string' ? req.body.name.trim().slice(0, 150) : prev.name,
      type:  typeof req.body.type  === 'string' ? req.body.type.trim().slice(0, 40)  : prev.type,
      price: Number.isFinite(Number(req.body.price)) ? Math.trunc(Number(req.body.price)) : prev.price,
      stock: nextStock,
    };

    if (req.body.imageSrc  !== undefined) update.imageSrc  = req.body.imageSrc  || '';
    if (Array.isArray(req.body.images))    update.images   = req.body.images;

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    // historial
    const changes = diffProduct(prev, updated.toObject());
    if (changes.length) {
      try {
        await History.create({
          user:  whoDidIt(req),
          action:'actualizó producto',
          item:  `${updated.name} (#${updated._id})`,
          date:  new Date(),
          details: changes.join(' | '),
        });
      } catch (e) {
        console.warn('Historial update falló:', e.message);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

/** DELETE /api/products/:id  (elimina y borra imágenes en Cloudinary) */
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
        item:  `${product.name} (#${product._id})`,
        date:  new Date(),
        details: `imagenes borradas: ${product.images?.length || 0}`,
      });
    } catch (e) {
      console.warn('Historial delete falló:', e.message);
    }

    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

export default router;