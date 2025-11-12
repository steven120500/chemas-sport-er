import mongoose from "mongoose";


/* =========================
   TALLAS PERMITIDAS
   ========================= */
const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const KID_SIZES   = ['16', '18', '20', '22', '24', '26', '28'];
const BALL_SIZES  = ['3', '4', '5']; // ⚽️ nuevas tallas para balones
const ALL_SIZES   = new Set([...ADULT_SIZES, ...KID_SIZES, ...BALL_SIZES]);


/* =========================
   VALIDADORES
   ========================= */


// Acepta: null/undefined | dataURL base64 | URL http(s) (Cloudinary)
const imageAnyValidator = {
  validator(v) {
    if (v == null) return true; // permite null/undefined
    if (typeof v !== 'string') return false;


    // dataURL base64 con extensión válida
    const isData = /^data:image\/(png|jpe?g|webp|heic|heif);base64,/i.test(v);
    // URL http(s)
    const isHttp = /^https?:\/\/\S+/i.test(v);


    return isData || isHttp;
  },
  message: 'Imagen inválida: debe ser data URL base64 o una URL http(s).'
};


// ✅ Validador flexible: solo revisa que sean números enteros >= 0
const stockValidator = {
  validator(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    for (const [size, qty] of Object.entries(obj)) {
      const n = Number(qty);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return false;
    }
    return true;
  },
  message: 'Inventario inválido. Debe ser un objeto { talla: cantidad>=0 }.'
};


/* =========================
   SUB-ESQUEMA DE IMÁGENES
   ========================= */
const ImageSchema = new mongoose.Schema(
  {
    public_id: { type: String, trim: true },  // id en Cloudinary
    url:       { type: String, trim: true }   // secure_url
  },
  { _id: false }
);


/* =========================
   SCHEMA PRINCIPAL
   ========================= */
const productSchema = new mongoose.Schema(
  {
    // Nombre del producto
    name:  { type: String, required: true, trim: true, maxlength: 150 },


    // Precio base
    price: { type: Number, required: true, min: 0 },


    // 💰 Precio con descuento (opcional)
    discountPrice: { type: Number, default: 0, min: 0 },


    // Imagen principal (para cards/listas)
    imageSrc: { type: String, trim: true, maxlength: 600, validate: imageAnyValidator },


    // Galería de imágenes (Cloudinary)
    images: { type: [ImageSchema], default: [] },


    // Inventario visible (Tienda #1)
    stock: { type: Object, required: true, default: {}, validate: stockValidator },


    // Inventario oculto (Tienda #2 / bodega)
    bodega: { type: Object, default: {}, validate: stockValidator },


    // Tipo de producto (Player, Fan, Mujer, Niño, Balón, etc.)
    type: { type: String, required: true, trim: true, maxlength: 40 },


    // Texto alternativo para SEO/accesibilidad
    imageAlt: { type: String, trim: true, maxlength: 150 }
  },
  { timestamps: true }
);


/* =========================
   HOOKS Y LIMPIEZAS
   ========================= */


// Redondea precio y descuento a enteros
productSchema.pre('validate', function (next) {
  if (typeof this.price === 'number' && Number.isFinite(this.price)) {
    this.price = Math.trunc(this.price);
  }
  if (typeof this.discountPrice === 'number' && Number.isFinite(this.discountPrice)) {
    this.discountPrice = Math.trunc(this.discountPrice);
  }
  next();
});


/* =========================
   ÍNDICES
   ========================= */
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 1 });
productSchema.index({ type: 1 });
productSchema.index({ price: 1, createdAt: -1 });


/* =========================
   SALIDA JSON LIMPIA
   ========================= */
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
