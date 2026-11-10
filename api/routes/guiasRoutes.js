import express from 'express';
import Guia from '../models/Guia.js';

import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Guardar nueva guía
const CAMPOS_GUIA = ['numeroGuia', 'nombre', 'provincia', 'canton', 'distrito', 'telefono', 'debe', 'monto',
  'meterRaspa', 'esMayorista', 'nombreMayorista', 'comentarios', 'fechaYMD', 'fecha'];
const soloCamposGuia = (body = {}) =>
  Object.fromEntries(CAMPOS_GUIA.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const nuevaGuia = new Guia(soloCamposGuia(req.body));
    const saved = await nuevaGuia.save();
    res.status(200).json({ success: true, guia: saved });
  } catch (error) {
    console.error("Error al guardar guía:", error);
    res.status(500).json({ error: "Error al guardar la guía en la base de datos." });
  }
});

// Obtener todas las guías (o filtradas por fecha si mandan ?fecha=YYYY-MM-DD)
router.get('/', async (req, res) => {
  try {
    const { fecha } = req.query;
    const filtro = fecha ? { fechaYMD: fecha } : {};
    const guias = await Guia.find(filtro).sort({ createdAt: -1 });
    res.status(200).json({ success: true, items: guias });
  } catch (error) {
    console.error("Error al obtener guías:", error);
    res.status(500).json({ error: "Error al consultar las guías." });
  }
});

// ✏️ Editar una guía (monto, deuda, datos del destinatario, comentarios...)
router.put('/:id', async (req, res) => {
  try {
    const cambios = soloCamposGuia(req.body);
    delete cambios.fechaYMD; // 👈 la fecha de creación no se cambia al editar
    delete cambios.fecha;
    const guia = await Guia.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });
    res.status(200).json({ success: true, guia });
  } catch (error) {
    console.error("Error al editar guía:", error);
    res.status(500).json({ error: "Error al editar la guía." });
  }
});

// Eliminar una guía
router.delete('/:id', async (req, res) => {
  try {
    await Guia.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Guía eliminada" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar la guía." });
  }
});

export default router;