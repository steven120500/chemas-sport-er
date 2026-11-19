// models/Reserva.js
// ⏳ Camisetas apartadas en el carrito de la tienda online (10 min desde que se agregan).
// Mientras la reserva está viva, esa unidad no se le ofrece a otro cliente (el inventario real NO se toca:
// se rebaja recién cuando Tilopay confirma el pago). Ver utils/reservas.js.
import mongoose from 'mongoose';

const reservaSchema = new mongoose.Schema(
  {
    carritoId: { type: String, required: true, index: true }, // id aleatorio del navegador (localStorage)
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    talla: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true },
    orderNumber: String, // cuando el cliente toca "Pagar" se amarra a la orden (y se alarga mientras paga)
  },
  { timestamps: true }
);

reservaSchema.index({ carritoId: 1, productId: 1, talla: 1 }, { unique: true });
// 🧹 Respaldo: Mongo borra solo las vencidas hace más de 1 h (la limpieza fina, con aviso en vivo, la hace utils/reservas.js)
reservaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.models.Reserva || mongoose.model('Reserva', reservaSchema);
