import express from 'express';
import Guia from '../models/Guia.js';

const router = express.Router();

// Guardar nueva guía
router.post('/', async (req, res) => {
  try {
    const nuevaGuia = new Guia(req.body);
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