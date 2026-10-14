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
  comentarios: { type: String, default: "" },
  fechaYMD: { type: String, required: true }, // Formato YYYY-MM-DD para el calendario
  fecha: { type: String, required: true }     // Fecha y hora formateada
}, { timestamps: true });

export default mongoose.model('Guia', guiaSchema);