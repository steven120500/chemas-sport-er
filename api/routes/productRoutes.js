// api/routes/productRoutes.js
import express from 'express';
import Product from '../models/Product.js';
import History from '../models/History.js';

const router = express.Router();

/* ----------------------------- helpers ------------------------------ */

// Tallas permitidas
const ADULT_SIZES = ['S','M','L','XL','XXL','3XL','4XL'];
const KID_SIZES   = ['16','18','20','22','24','26','28'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES]);

// Límite de longitud de cada imagen en base64 (caracteres)
const MAX_IMAGE_BASE64_LEN = 5_000_000; // ~5MB por imagen en base64

// Quién hizo el cambio (toma del header, body o deja “Sistema”)
function whoDidIt(req) {
  return (
    req.headers['x-user'] ||
    req.body?.user ||
    req.user?.name ||
    'Sistema'
  );
}

// Diff de stock (obj1 vs obj2) -> ["stock[S]: a -> b", ...]
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

// Diferencias “legibles” de producto
function diffProduct(prev, next) {
  const changes = [];
  if (prev.name !== next.name) changes.push(`nombre: "${prev.name}" -> "${next.name}"`);
  if (prev.price !== next.price) changes.push(`precio: ${prev.price} -> ${next.price}`);
  if (prev.type !== next.type) changes.push(`tipo: "${prev.type}" -> "${next.type}"`);
  changes.push(...diffStock(prev.stock, next.stock));
  return changes;
}

/* -------------------------- sanea y valida el body -------------------------- */
/**
 * Sanea y valida el body. Lanza Error con details si algo está mal.
 * @param {object} body
 * @param {boolean} partial - true cuando es update (PUT), permite campos faltantes
 * @returns {object} objeto listo para guardar
 */
function sanitizeAndValidate(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  // name
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name debe ser string no vacío.');
    } else {
      out.name = body.name.trim().slice(0, 150);
    }
  } else if (!partial) {
    errors.push('name es requerido.');
  }

  // price (acepta string numérica)
  if (body.price !== undefined) {
    const n = typeof body.price === 'number'
      ? body.price
      : Number(String(body.price).replace(/[^\d]/g, ''));
    if (!Number.isFinite(n) || n <= 0) errors.push('price inválido.');
    else out.price = Math.trunc(n);
  } else if (!partial) {
    errors.push('price es requerido.');
  }

  // type
  if (body.type !== undefined) {
    if (typeof body.type !== 'string' || !body.type.trim()) {
      errors.push('type debe ser string.');
    } else {
      out.type = body.type.trim().slice(0, 40);
    }
  } else if (!partial) {
    errors.push('type es requerido.');
  }

  // imageAlt
  if (body.imageAlt !== undefined) {
    if (typeof body.imageAlt !== 'string') {
      errors.push('imageAlt debe ser string.');
    } else {
      out.imageAlt = body.imageAlt.slice(0, 150);
    }
  }

  // imageSrc / imageSrc2 (base64 opcional – con límite)
  for (const key of ['imageSrc', 'imageSrc2']) {
    if (body[key] !== undefined && body[key] !== null) {
      if (typeof body[key] !== 'string') {
        errors.push (`${key} debe ser string base64 (data URL).`);
      } else if (body[key].length > MAX_IMAGE_BASE64_LEN) {
        errors.push(`${key} es muy grande (límite ${MAX_IMAGE_BASE64_LEN} chars).`);
      } else {
        out[key] = body[key];
      }
    } else if (!partial && key === 'imageSrc') {
      // en create es requerida la imagen principal
      errors.push('imageSrc es requerido.');
    }
  }

  // stock objeto { talla: cantidad }
  if (body.stock !== undefined) {
    if (typeof body.stock !== 'object' || body.stock === null || Array.isArray(body.stock)) {
      errors.push('stock debe ser objeto { talla: cantidad }.');
    } else {
      const cleanStock = {};
      for (const [size, qty] of Object.entries(body.stock)) {
        if (!ALL_SIZES.has(String(size))) continue; // ignora tallas desconocidas
        const n = Number(qty);
        cleanStock[size] = Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
      }
      out.stock = cleanStock;
    }
  } else if (!partial) {
    out.stock = {}; // por defecto vacío
  }

  if (errors.length) {
    const err = new Error('VALIDATION_ERROR');
    err.details = errors;
    throw err;
  }

  return out;
}

/* --------------------------------- rutas --------------------------------- */

// Crear producto
router.post('/', async (req, res) => {
  try {
    const data = sanitizeAndValidate(req.body, { partial: false });
    const newProduct = new Product(data);
    const saved = await newProduct.save();

    // Log de historial
    await History.create({
      user: whoDidIt(req),
      action: 'creó producto',
      item: `${saved.name} (#${saved._id})`,
      date: new Date(),
    });

    res.status(201).json({ message: 'Producto guardado', product: saved });
  } catch (error) {
    if (error.message === 'VALIDATION_ERROR') {
      console.error('× Validación (POST):', error.details);
      return res.status(400).json({ error: 'Payload inválido', details: error.details });
    }
    console.error('× Error al guardar producto:', error);
    res.status(500).json({ message: 'Error al guardar producto' });
  }
});

// Obtener todos (ordenados por reciente) y Lean para perf
router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(products);
  } catch (error) {
    console.error('× Error al obtener los productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// Endpoint opcional de salud / conteo
router.get('/health', async (_req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ ok: true, count });
  } catch (_e) {
    res.status(500).json({ ok: false });
  }
});

// Actualizar producto
router.put('/:id', async (req, res) => {
  try {
    // obtener versión previa para armar el diff
    const prev = await Product.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ message: 'Producto no encontrado' });

    const data = sanitizeAndValidate(req.body, { partial: true });
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    );

    // Log de historial (solo si hubo cambios)
    const changes = diffProduct(prev, updated.toObject());
    if (changes.length) {
      await History.create({
        user: whoDidIt(req),
        action: 'actualizó producto',
        item: `${updated.name} (#${updated._id})`,
        details: changes.join(' | '),
        date: new Date(),
      });
    }

    res.json(updated);
  } catch (error) {
    if (error.message === 'VALIDATION_ERROR') {
      console.error('× Validación (PUT):', error.details);
      return res.status(400).json({ error: 'Payload inválido', details: error.details });
    }
    console.error('× Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
});

// Eliminar producto
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Producto no encontrado' });

    // Log de historial
    await History.create({
      user: whoDidIt(req),
      action: 'eliminó producto',
      item: `${deleted.name} (#${deleted._id})`,
      date: new Date(),
    });

    res.json({ message: 'Producto eliminado con éxito' });
  } catch (error) {
    console.error('× Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
});

export default router;