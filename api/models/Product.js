import mongoose from 'mongoose';

// -------------------- Tallas --------------------
const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const KID_SIZES = ['16', '18', '20', '22', '24', '26', '28'];
const ALL_SIZES = new Set([...ADULT_SIZES, ...KID_SIZES]);

// -------------------- Límite imágenes Base64 --------------------
const MAX_IMAGE_BASE64_LEN = 15_000_000; // ~15MB en string base64

// -------------------- Validadores --------------------
const imageValidator = {
  validator(v) {
    if (v == null) return true; // puede ser null
    if (typeof v !== 'string') return false;
    if (v.length > MAX_IMAGE_BASE64_LEN) return false;

    // Acepta png/jpg/jpeg/webp/heic en base64
    return /^data:image\/(png|jpe?g|webp|heic);base64,/i.test(v);
  },
  message: 'Imagen inválida o demasiado grande (máx ~15MB, formatos: png/jpg/jpeg/webp/heic).'
};

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
  message: 'Stock inválido. Debe ser un objeto { talla: cantidad>=0 } con tallas válidas.'
};

// -------------------- Sub-schema para Cloudinary --------------------
const ImageSchema = new mongoose.Schema({
  public_id: { type: String }, // ID en Cloudinary
  url: { type: String },       // secure_url de Cloudinary
}, { _id: false });

// -------------------- Product Schema --------------------
const productSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true, maxlength: 150 },
  price:  { type: Number, required: true, min: 0 },
  type:   { type: String, required: true, trim: true, maxlength: 40 },

  // Compatibilidad con tu sistema actual
  imageSrc:  { type: String, trim: true, maxlength: 150, validate: imageValidator },
  imageSrc2: { type: String, trim: true, maxlength: 150, validate: imageValidator },

  // Nuevo: imágenes subidas a Cloudinary
  images: [ImageSchema], 

  // Stock
  stock: { type: Object, required: true, validate: stockValidator }
}, { timestamps: true });

// -------------------- Hooks --------------------
// Redondea precio a entero si viene con decimales
productSchema.pre('validate', function (next) {
  if (typeof this.price === 'number' && Number.isFinite(this.price)) {
    this.price = Math.trunc(this.price);
  }
  next();
});

// -------------------- Índices --------------------
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 1 });
productSchema.index({ type: 1 });
productSchema.index({ type: 1, createdAt: -1 });

// -------------------- Limpieza salida JSON --------------------
productSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  }
});

productSchema.set('toObject', { virtuals: false, versionKey: false });
productSchema.set('minimize', true);
productSchema.set('strictQuery', true);

export default mongoose.model('Product', productSchema);