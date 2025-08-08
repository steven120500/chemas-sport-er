// models/Product.js
import mongoose from 'mongoose';

const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const KID_SIZES   = ['16','18','20','22','24','26','28'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES]);

// ~1 MB en base64 por imagen (ajústalo si ocupás más)
const MAX_IMAGE_BASE64_LEN = 1_000_000;

// Valida data URL de imagen en base64 y limita tamaño
const imageValidator = {
  validator(v) {
    if (v == null) return true; // opcional para imageSrc2
    if (typeof v !== 'string') return false;
    if (v.length > MAX_IMAGE_BASE64_LEN) return false;
    // Acepta png/jpg/jpeg/webp/heic en data URL
    return /^data:image\/(png|jpe?g|webp|heic);base64,/i.test(v);
  },
  message:
    'Imagen inválida o demasiado grande (máx ~1MB, formatos: png/jpg/jpeg/webp/heic).',
};

// Valida objeto stock { talla: cantidad>=0 } usando tallas conocidas
const stockValidator = {
  validator(obj) {
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return false;
    for (const [size, qty] of Object.entries(obj)) {
      if (!ALL_SIZES.has(String(size))) return false;
      const n = Number(qty);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return false;
    }
    return true;
  },
  message:
    'Stock inválido. Debe ser un objeto { talla: cantidad>=0 } con tallas válidas.',
};

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      // Si querés forzar tipos, descomenta y ajusta:
      // enum: ['Player','Fan','Mujer','Niño','Nacional','NBA','Retro','Abrigo'],
    },
    imageSrc: { type: String, required: true, validate: imageValidator },
    imageSrc2: { type: String, validate: imageValidator },
    imageAlt: { type: String, default: '', trim: true, maxlength: 150 },
    stock: { type: Object, required: true, validate: stockValidator }, // p.ej.: { S: 3, M: 4 }
  },
  { timestamps: true }
);

// Redondea precio a entero por si viene como 22000.9
productSchema.pre('validate', function (next) {
  if (typeof this.price === 'number' && Number.isFinite(this.price)) {
    this.price = Math.trunc(this.price);
  }
  next();
});

// Índice útil para listados recientes
productSchema.index({ createdAt: -1 });

export default mongoose.model('Product', productSchema);