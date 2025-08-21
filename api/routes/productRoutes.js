// api/routes/productRoutes.js
import express from 'express';
import Product from '../models/Product.js';
import History from '../models/History.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

const router = express.Router();

// ===== Multer (buffer en memoria) =====
const storage = multer.memoryStorage();
const upload  = multer({ storage });

// ===== Helpers =====

// Tallas permitidas (para validar stock opcionalmente)
const ADULT_SIZES = ['S','M','L','XL','XXL','3XL','4XL'];
const KID_SIZES   = ['16','18','20','22','24','26','28'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES]);

// Quién hizo el cambio (intenta header/body; cae en "Sistema")
function whoDidIt(req) {
  return req.user?.name || req.user?.email || req.headers['x-user'] || req.body.user || 'Sistema';
}

// Diferencias de stock legibles (para historial)
function diffStock(prev = {}, next = {}) {
  const sizes = new Set([...(Object.keys(prev||{})), ...(Object.keys(next||{}))]);
  const out = [];
  for (const s of sizes) {
    const a = Number(prev?.[s] ?? 0);
    const b = Number(next?.[s] ?? 0);
    if (a !== b) out.push(`stock[${s}]: ${a} -> ${b}`);
  }
  return out;
}

// Diferencias legibles de producto (para historial)
function diffProduct(prev, next) {
  const ch = [];
  if (prev.name !== next.name) ch.push(`nombre: "${prev.name}" -> "${next.name}"`);
  if (prev.price !== next.price) ch.push(`precio: ${prev.price} -> ${next.price}`);
  if (prev.type !== next.type) ch.push(`tipo: "${prev.type}" -> "${next.type}"`);
  ch.push(...diffStock(prev.stock, next.stock));
  return ch;
}

// Sube 1 buffer a Cloudinary (promisificado)
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// ===== Rutas =====

// Crear producto (múltiples imágenes)
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    // 1) validar imágenes
    if (!req.files?.length) {
      return res.status(400).json({ error: 'No se enviaron imágenes' });
    }

    // 2) subir todas a cloudinary
    const uploaded = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer)));
    // normalizar [{ public_id, url }]
    const images = uploaded.map(u => ({ public_id: u.public_id, url: u.secure_url }));
    const imageSrc = images[0]?.url || ''; // principal = primera

    // 3) parsear stock/sizes (llega como string en form-data)
    let stock = {};
    try {
      if (typeof req.body.stock === 'string') stock = JSON.parse(req.body.stock);
      else if (typeof req.body.sizes === 'string') stock = JSON.parse(req.body.sizes);
    } catch (_) { stock = {}; }

    // (opcional) sanitizar tallas: filtra claves no permitidas y fuerza enteros >=0
    const cleanStock = {};
    for (const [size, qty] of Object.entries(stock || {})) {
      if (!ALL_SIZES.has(String(size))) continue;
      const n = Math.max(0, Math.trunc(Number(qty) || 0));
      cleanStock[size] = n;
    }

    // 4) crear en Mongo
    const product = await Product.create({
      name: String((req.body.name || '')).trim(),
      price: Number(req.body.price),
      type:  String((req.body.type || '')).trim(),
      stock: cleanStock,
      imageSrc,       // usada por la tarjeta/lista
      images,         // arreglo completo de cloudinary
    });

    // 5) historial (no romper si falla)
    try {
      await History.create({
        user:  whoDidIt(req),
        action:'creó producto',
        item:  `${product.name} (#${product._id})`,
        date:  new Date(),
        details: `img: ${imageSrc}`,
      });
    } catch (e) {
      console.warn('No se pudo guardar historial:', e.message);
    }

    // 6) responder
    res.status(201).json(product);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: err.message || 'Error al crear producto' });
  }
});

// Actualizar producto (sin re-subir imágenes)
router.put('/:id', async (req, res) => {
  try {
    const prev = await Product.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ error: 'Producto no encontrado' });

    // parsear/limpiar posibles campos
    const next = {
      name: typeof req.body.name === 'string' ? req.body.name.trim().slice(0,150) : prev.name,
      type: typeof req.body.type === 'string' ? req.body.type.trim().slice(0,40)  : prev.type,
      price: Number.isFinite(Number(req.body.price)) ? Math.trunc(Number(req.body.price)) : prev.price,
      stock: prev.stock,
    };

    // stock (JSON)
    try {
      if (typeof req.body.stock === 'string') {
        const raw = JSON.parse(req.body.stock);
        const clean = {};
        for (const [size, qty] of Object.entries(raw || {})) {
          if (!ALL_SIZES.has(String(size))) continue;
          const n = Math.max(0, Math.trunc(Number(qty) || 0));
          clean[size] = n;
        }
        next.stock = clean;
      }
    } catch (_) { /* ignorar */ }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      next,
      { new: true, runValidators: true }
    );

    // historial de cambios
    const changes = diffProduct(prev, updated.toObject());
    if (changes.length) {
      try {
        await History.create({
          user:  whoDidIt(req),
          action:'actualizó producto',
          item:  `${updated.name} (#${updated._id})`,
          date:  new Date(),
          details: changes.join(' | ')
        });
      } catch (e) {
        console.warn('No se pudo guardar historial:', e.message);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// Eliminar producto + borrar imágenes de Cloudinary
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    // borrar imágenes
    for (const img of product.images || []) {
      if (img.public_id) {
        try { await cloudinary.uploader.destroy(img.public_id); } catch (_) { /* ignore */ }
      }
    }

    await product.deleteOne();
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// Salud / conteo rápido
router.get('/health', async (_req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ ok: true, count });
  } catch (_) {
    res.status(500).json({ ok: false });
  }
});

// Listado paginado (sin campos pesados innecesarios)
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const q     = (req.query.q || '').trim();
    const type  = (req.query.type || '').trim();

    const find = {};
    if (q) find.name = { $regex: q, $options: 'i' };
    if (type) find.type = type;

    // PROYECCIÓN: evita mandar stock completo si no lo usás en la lista
    const projection = 'name price type imageSrc images createdAt';

    const [items, total] = await Promise.all([
      Product.find(find)
        .select(projection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(find),
    ]);

    // cache cortito del navegador
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