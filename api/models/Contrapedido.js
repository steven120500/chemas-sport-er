// models/Contrapedido.js
// 🗓️ Contrapedido de comisiones por vendedor y mes (antes vivía en localStorage del dispositivo que lo metía).
import mongoose from 'mongoose';

const contrapedidoSchema = new mongoose.Schema(
  {
    mes: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // YYYY-MM
    vendedor: { type: String, required: true, trim: true },
    semanas: { type: [Number], default: [0, 0, 0, 0] }, // 4 (o 5 si el mes tuvo semana extra)
    actualizadoPor: { type: String, default: '' },
  },
  { timestamps: true }
);

contrapedidoSchema.index({ mes: 1, vendedor: 1 }, { unique: true });

export default mongoose.models.Contrapedido || mongoose.model('Contrapedido', contrapedidoSchema);
