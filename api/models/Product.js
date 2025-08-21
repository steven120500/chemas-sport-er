// models/Product.js
import mongoose from 'mongoose';

/* -------------------- Tallas -------------------- */
const ADULT_SIZES = ['S','M','L','XL','XXL','3XL','4XL'];
const KID_SIZES   = ['16','18','20','22','24','26','28'];
const ALL_SIZES   = new Set([ ...ADULT_SIZES, ...KID_SIZES ]);

/* ------------------ Validadores ----------------- */
// Acepta: null/undefined | dataURL base64 | URL http(s) (Cloudinary)
const imageAnyValidator = {
  validator(v) {
    if (v == null) return true;                 // permite null/undefined
    if (typeof v !== 'string') return false;
    const isData = /^data:image\/(png|jpe?g|webp|heic);base64,/i.test(v);
    const isHttp = /^https?:\/\//i.test(v);
    return isData || isHttp;
  },
  message: 'Imagen inválida: debe ser data URL base64 o una URL http(s).',
};

// stock debe ser { talla: cantidad>=0 } con tallas válidas
const stockValidator = {
  validator(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    for (const [size, qty] of Object.entries(obj)) {
      if (!ALL_SIZES.has(String(size))) return false;
      const n = Number(qty);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return false;
    }
    return true;
  },
  message: 'Stock inválido. Debe ser un objeto { talla: cantidad>=0 } con tallas válidas.',
};

/* --------- Sub‑schema para imágenes (Cloudinary) -------- */
const ImageSchema = new mongoose.Schema(
  {
    public_id: { type: String, trim: true },   // id en Cloudinary
    url:       { type: String, trim: true },   // secure_url
  },
  { _id: false }
);

/* ------------------ Schema principal ------------------ */
const productSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true, maxlength: 150 },
    price: { type: Number, required: true, min: 0 },
    type:  { type: String, required: true, trim: true, maxlength: 40 },

    // Compatibilidad con el front (principal para cards/listas)
    imageSrc: { type: String, trim: true, maxlength: 600, validate: imageAnyValidator },

    // Nuevo: arreglo de imágenes subidas a Cloudinary
    images: { type: [ImageSchema], default: [] },

    // Stock por talla
    stock: { type: Object, required: true, validate: stockValidator },
  },
  { timestamps: true }
);

/* ----------------------- Hooks ------------------------ */
// Redondea precio a entero si viene con decimales
productSchema.pre('validate', function (next) {
  if (typeof this.price === 'number' && Number.isFinite(this.price)) {
    this.price = Math.trunc(this.price);
  }
  next();
});

/* ---------------------- Índices ----------------------- */
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 1 });
productSchema.index({ type: 1 });
productSchema.index({ type: 1, createdAt: -1 });

/* --------- Limpieza de salida JSON/Objeto --------- */
productSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});
productSchema.set('toObject', { virtuals: false, versionKey: false });
productSchema.set('minimize', true);
productSchema.set('strictQuery', true);

export default mongoose.model('Product', productSchema);