import mongoose from 'mongoose';

const guiaSchema = new mongoose.Schema({
  numeroGuia: { type: String, required: true },
  nombre: { type: String, required: true },
  provincia: { type: String, required: true },
  canton: { type: String, required: true },
  distrito: { type: String, required: true },
  telefono: { type: String, required: true },
  debe: { type: String, default: "No" },
  monto: { type: String, default: "0" },
  meterRaspa: { type: String, default: "No" },
  esMayorista: { type: String, default: "No" },
  nombreMayorista: { type: String, default: "" },
  esCambio: { type: String, default: "No" }, // 🔄 "Sí" si el mensajero tiene que recoger algo de vuelta
  detalleCambio: { type: String, default: "" }, // qué devuelve el cliente (sale en la guía)
  comentarios: { type: String, default: "" },
  fechaEntrega: { type: String, default: "" }, // 📅 YYYY-MM-DD (opcional), sale grande en el centro de la guía
  fechaYMD: { type: String, required: true }, // Formato YYYY-MM-DD para el calendario
  fecha: { type: String, required: true }     // Fecha y hora formateada
}, { timestamps: true });

export default mongoose.model('Guia', guiaSchema);