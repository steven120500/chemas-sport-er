// models/Product.js
import mongoose from 'mongoose';

// ------------------------ Tallas ------------------------
const ADULT_SIZES = ['S','M','L','XL','XXL','3XL','4XL'];
const KID_SIZES   = ['16','18','20','22','24','26','28'];
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES]);

// Límite de longitud para imágenes en base64 (~15MB en string base64)
const MAX_IMAGE_BASE64_LEN = 15_000_000;

// --------------------- Validadores ----------------------

// Valida una data URL de imagen base64 y limita el tamaño
const imageValidator = {
  validator(v) {
    if (v == null) return true; // opcional para imageSrc2
    if (typeof v !== 'string') return false;
    if (v.length > MAX_IMAGE_BASE64_LEN) return false;
    // Acepta png/jpg/jpeg/webp/heic en data URL
    return /^data:image\/(png|jpe?g|webp|heic);base64,/i.test(v);
  },
  message:
    'Imagen inválida o demasiado grande (máx ~15MB, formatos: png/jpg/jpeg/webp/heic).',
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
  message: 'Stock inválido. Debe ser un objeto { talla: cantidad>=0 } con tallas válidas.',
};

// ------------------------ Schema ------------------------
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
      // Si quieres forzar tipos:
      // enum: ['Player','Fan','Mujer','Niño','Nacional','NBA','MLB','NFL','Abrigo'],
    },
    imageSrc:  { type: String, required: true,  validate: imageValidator },
    imageSrc2: { type: String,                validate: imageValidator },
    imageAlt:  { type: String, default: '', trim: true, maxlength: 150 },
    // Ejemplo de stock: { S: 3, M: 4 }
    stock: { type: Object, required: true, validate: stockValidator },
  },
  { timestamps: true }
);

// Redondea price a entero por si viene como 22000.9
productSchema.pre('validate', function (next) {
  if (typeof this.price === 'number' && Number.isFinite(this.price)) {
    this.price = Math.trunc(this.price);
  }
  next();
});

// ------------------------ Índices ------------------------
// Útil para listados recientes
productSchema.index({ createdAt: -1 });

// Para búsquedas y filtros rápidos
productSchema.index({ name: 1 });
productSchema.index({ type: 1 });

// (Opcional) si luego usas $text en vez de regex para nombre
// productSchema.index({ name: 'text' });

export default mongoose.model('Product', productSchema);