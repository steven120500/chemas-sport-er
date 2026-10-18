import mongoose from 'mongoose';

const tiendaFacturaSchema = new mongoose.Schema({
  fechaYMD: { type: String, required: true, index: true }, // Ej: "2026-10-17"
  fechaHora: { type: String, required: true },             // Ej: "17/10/2026 04:30 p. m."
  consecutivoOficial: { type: String, required: true },
  alegraId: { type: String, default: "" },
  tipoEmision: { type: String, default: "hacienda" },      // "hacienda" | "interno"
  
  // Datos del cliente para el historial y reimpresión
  cliente: {
    nombre: { type: String, default: "Cliente de Contado" },
    cedula: { type: String, default: "" },
    tipoIdentificacion: { type: String, default: "01" },
    telefono: { type: String, default: "" },
    correo: { type: String, default: "" }
  },

  // Método de pago y desglose exacto para el cuadre de caja
  metodoPago: { 
    type: String, 
    enum: ["Efectivo", "Datáfono", "SINPE", "Mixto"], 
    default: "Efectivo" 
  },
  montoEfectivo: { type: Number, default: 0 },
  montoDatafono: { type: Number, default: 0 },
  montoSinpe: { type: Number, default: 0 },
  totalCobrado: { type: Number, required: true },

  // Lista de prendas/artículos vendidos (guardado para reimpresión exacta del tiquete)
  ventas: { type: Array, default: [] },
  vendedor: { type: String, default: "Tienda" },

  // IDs de los logs de historial ya facturados para saber cuáles ya se cobraron
  historyIds: [{ type: String }]
}, { timestamps: true });

export default mongoose.model('TiendaFactura', tiendaFacturaSchema);