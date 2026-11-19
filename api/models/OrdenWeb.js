// models/OrdenWeb.js
// 🛒 Órdenes de la tienda online (checkout del carrito). Se crea al tocar "Pagar" (pendiente)
// y pasa a "pagada" solo cuando Tilopay lo confirma por consult (ver routes/checkoutRoutes.js).
// Precios, envío y total los calcula SIEMPRE el backend desde la BD.
import mongoose from 'mongoose';
import { Contador } from './Pedido.js';

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    type: String,
    imageSrc: String,
    talla: { type: String, required: true },
    dorsal: { name: String, number: String },
    cantidad: { type: Number, required: true, min: 1 },
    precio: { type: Number, required: true, min: 0 }, // unitario, ya con oferta
  },
  { _id: false }
);

const ordenWebSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, unique: true },
    orderNumber: { type: String, required: true, unique: true }, // el que se manda a Tilopay (CSW000123)
    token: { type: String, required: true }, // secreto para que solo el cliente vea su resultado
    cliente: {
      cedula: String,
      nombre: String,
      apellidos: String,
      telefono: String,
      correo: String,
    },
    entrega: {
      tipo: { type: String, enum: ['mensajero', 'correos', 'retiro'], required: true },
      provincia: String,
      canton: String,
      distrito: String,
      senas: String,
    },
    items: [itemSchema],
    subtotal: { type: Number, required: true },
    envio: { type: Number, required: true },
    total: { type: Number, required: true },
    notas: String,
    metodoPago: { type: String, enum: ['tarjeta'], default: 'tarjeta' },
    estado: { type: String, enum: ['pendiente', 'pagada', 'rechazada'], default: 'pendiente', index: true },
    pagadaAt: Date,
    tilopay: {
      code: String,
      description: String,
      auth: String,
      idTransaccion: String,
      card: String,
      last: String,
      environment: String,
    },
    // 📦 Inventario rebajado al pagar (utils/ordenesWeb.js → rebajarStockOrden)
    stock: {
      estado: { type: String, enum: ['rebajando', 'listo', 'error'] },
      movimientos: [{ _id: false, productId: mongoose.Schema.Types.ObjectId, talla: String, ubicacion: String, cantidad: Number, historyId: String, dorsalesDescontados: [mongoose.Schema.Types.Mixed] }],
      faltantes: [String], // lo que no se pudo rebajar (se vendió en otro lado mientras pagaba)
      error: String,
      at: Date,
    },
    // 🧾 Tiquete electrónico en Alegra (utils/ordenesWeb.js → facturarOrden)
    factura: {
      estado: { type: String, enum: ['facturando', 'lista', 'error'] },
      alegraId: String,
      consecutivo: String,
      pdfUrl: String,
      correoEnviado: Boolean,
      error: String,
      at: Date,
    },
  },
  { timestamps: true }
);

export async function siguienteNumeroOrdenWeb() {
  const c = await Contador.findOneAndUpdate({ _id: 'ordenweb' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}

export default mongoose.models.OrdenWeb || mongoose.model('OrdenWeb', ordenWebSchema);
