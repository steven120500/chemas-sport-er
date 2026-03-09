import express from 'express';
import Product from '../models/Product.js';
import History from '../models/History.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

const router = express.Router();

/* ======================= Multer (Memoria) ======================= */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================== Helpers ============================ */

// Tallas permitidas (incluye BALONES)
const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const KID_SIZES   = ['16', '18', '20', '22', '24', '26', '28'];
const BALL_SIZES  = ['3', '4', '5']; 
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES, ...BALL_SIZES]);

// Identificar quién hizo el cambio
function whoDidIt(req) {
  return req.user?.name ||
         req.user?.email ||
         req.headers['x-user'] ||
         req.body.user ||
         'Sistema';
}

// Mostrar cambios de inventario
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

// Mostrar cambios generales
function diffProduct(prev, next) {
  const changes = [];
  if (prev.name !== next.name) changes.push(`nombre: "${prev.name}" → "${next.name}"`);
  if (prev.price !== next.price) changes.push(`precio: ${prev.price} → ${next.price}`);
  if (prev.discountPrice !== next.discountPrice)
    changes.push(`descuento: ${prev.discountPrice} → ${next.discountPrice}`);
  if (prev.type !== next.type) changes.push(`tipo: "${prev.type}" → "${next.type}"`);
  
  // 🔥 CORRECCIÓN: Convertir ambos a booleano estricto para evitar el "No -> No"
  const prevMundial = Boolean(prev.isMundial2026);
  const nextMundial = Boolean(next.isMundial2026);
  
  if (prevMundial !== nextMundial) {
    changes.push(`Mundial 2026: ${prevMundial ? 'Sí' : 'No'} → ${nextMundial ? 'Sí' : 'No'}`);
  }

  changes.push(...diffInv('Tienda #1', prev.stock, next.stock));
  changes.push(...diffInv('Tienda #2', prev.bodega, next.bodega));

  return changes;
}

// Subir 1 imagen a Cloudinary
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Limpieza de inventario
function sanitizeInv(obj) {
  const clean = {};
  for (const [size, qty] of Object.entries(obj || {})) {
    if (!ALL_SIZES.has(String(size))) continue;
    const n = Math.max(0, Math.trunc(Number(qty) || 0));
    clean[size] = n;
  }
  return clean;
}

/* ========================= Crear Producto ========================= */
router.post('/', upload.any(), async (req, res) => {
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

    // Stock
    let stock = {};
    try {
      if (typeof req.body.stock === 'string') stock = JSON.parse(req.body.stock);
      else if (typeof req.body.sizes === 'string') stock = JSON.parse(req.body.sizes);
      else if (typeof req.body.stock === 'object') stock = req.body.stock;
    } catch { stock = {}; }

    const cleanStock = sanitizeInv(stock);

    // Bodega
    let bodega = {};
    try {
      if (typeof req.body.bodega === 'string') bodega = JSON.parse(req.body.bodega);
      else if (typeof req.body.bodega === 'object') bodega = req.body.bodega;
    } catch { bodega = {}; }

    const cleanBodega = sanitizeInv(bodega);

    const product = await Product.create({
      name: String(req.body.name || '').trim(),
      price: Number(req.body.price),
      discountPrice: Number(req.body.discountPrice) || 0,
      type: String(req.body.type || '').trim(),
      stock: cleanStock,
      bodega: cleanBodega,
      images,
      imageSrc,

      hidden: req.body.hidden === 'true' || req.body.hidden === true,
      
      // ⭐ NUEVO: Atrapar el checkbox del Mundial 2026
      isMundial2026: req.body.isMundial2026 === 'true' || req.body.isMundial2026 === true
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

/* ======================== Actualizar Producto ====================== */
router.put('/:id', async (req, res) => {
  try {
    const prev = await Product.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ error: 'Producto no encontrado' });

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
    for (const size of new Set([...Object.keys(prev.stock || {}), ...Object.keys(nextStock || {})])) {
      const before = Number(prev.stock?.[size] ?? 0);
      const after  = Number(nextStock?.[size] ?? 0);
      if (before > after) restadas += (before - after);
    }

    const update = {
      name: req.body.name?.trim() || prev.name,
      type: req.body.type?.trim() || prev.type,
      price: Number.isFinite(Number(req.body.price)) ? Math.trunc(Number(req.body.price)) : prev.price,
      discountPrice: Number.isFinite(Number(req.body.discountPrice))
        ? Math.trunc(Number(req.body.discountPrice))
        : prev.discountPrice,
      stock: nextStock,
      bodega: nextBodega,
    };

    // actualizar hidden y Mundial 2026
    if (req.body.hidden !== undefined) {
      update.hidden = req.body.hidden === 'true' || req.body.hidden === true;
    }
    
    // ⭐ NUEVO: Actualizar el check del mundial en la base de datos
    if (req.body.isMundial2026 !== undefined) {
      update.isMundial2026 = req.body.isMundial2026 === 'true' || req.body.isMundial2026 === true;
    }

    // Manejo de imágenes
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
        } else {
          const found = prevList.find(i => i.url === raw);
          normalized.push(found || { public_id: null, url: raw });
        }
      }

      update.images = normalized;
      update.imageSrc = normalized[0]?.url || '';
    }

    let updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (restadas > 0) {
      updated.popularCountHistory.push({
        date: new Date().toISOString(),
        quantity: restadas
      });
    }

    const now = new Date();
    const totalMonth = updated.popularCountHistory
      .filter(entry => {
        const d = new Date(entry.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.quantity, 0);

    updated.isPopular = totalMonth >= 10;
    await updated.save();

    const changes = diffProduct(prev, updated.toObject());
    if (changes.length) {
      await History.create({
        user: whoDidIt(req),
        action: 'actualizó producto',
        item: `${updated.name} (${updated.type})`,
        date: new Date(),
        details: changes.join(' | ')
      });
    }

    res.json(updated);

  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

/* ========================== Eliminar Producto ========================= */
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    for (const img of product.images || []) {
      if (img.public_id) await cloudinary.uploader.destroy(img.public_id);
    }

    await product.deleteOne();

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
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const q     = (req.query.q || '').trim();
    const type  = (req.query.type || '').trim();
    const sizes = (req.query.sizes || '').trim();
    
    // ✅ 1. LEEMOS EL PARÁMETRO DE ORDENAMIENTO
    const sortParam = req.query.sort; 

    const find = {};

    /* =====================================================
       🔥 CONTROL DE OCULTOS (SUPERADMIN, ROLES, HEADER)
       ===================================================== */
    const user = req.user || {};
    let canSeeHidden = false;

    if (
      user.isSuperUser ||
      (user.roles || []).includes("edit") ||
      (user.roles || []).includes("ver_ocultos")
    ) {
      canSeeHidden = true;
    }

    if (req.headers["x-admin"] === "true") {
      canSeeHidden = true;
    }

    if (!canSeeHidden) {
      find.hidden = { $ne: true };
    }

    /* Filtro buscador */
    if (q) find.name = { $regex: q, $options: 'i' };

    /* Filtro tipo */
    if (type === 'Ofertas') {
      find.discountPrice = { $gt: 0 };
      find.$expr = { $lt: ['$discountPrice', '$price'] };
    } 
    else if (type === 'Populares') {
      find.isPopular = true;
    }
    // ⭐ NUEVO: Filtro para decirle a la Base de Datos que traiga los del Mundial
    else if (type === 'Mundial 2026') {
      find.isMundial2026 = true;
    }
    else if (type) {
      find.type = type;
    }
    
    /* Filtro por tallas */
    if (sizes) {
      const arr = sizes.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) {
        find.$or = arr.flatMap(size => ([
          { [`stock.${size}`]: { $gt: 0 } },
          { [`bodega.${size}`]: { $gt: 0 } },
        ]));
      }
    }

    // ⭐ NUEVO: Agregamos isMundial2026 a los datos que se devuelven al frontend
    const projection =
      'name price discountPrice type imageSrc images stock bodega createdAt isPopular hidden popularCountHistory isMundial2026';

    // ✅ 2. DEFINIMOS EL OBJETO DE ORDENAMIENTO
    const sortOptions = sortParam === 'desc' ? { _id: -1 } : { name: 1 };

    const [items, total] = await Promise.all([
      Product.find(find)
        .select(projection)
        .sort(sortOptions) // ✅ 3. APLICAMOS EL ORDEN AQUÍ
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