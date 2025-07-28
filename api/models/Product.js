// models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: String, required: true },
  type: { type: String, required: true },
  imageSrc: { type: String, required: true },
  imageAlt: { type: String },
  stock: { type: Object, required: true }, // Ej: { S: 3, M: 4 }
}, {
  timestamps: true,
});

export default mongoose.model('Product', productSchema);
