import express from 'express';
import History from '../models/History.js';

const router = express.Router();

// GET historial (ya lo tienes)
router.get('/', async (_req, res) => {
  try {
    const logs = await History.find().sort({ date: -1 }).limit(200).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
});


// DELETE /api/history - Elimina todo el historial
router.delete('/', async (req, res) => {
  try {
    await History.deleteMany({});
    res.json({ message: 'Historial eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar historial:', error);
    res.status(500).json({ message: 'Error al eliminar historial' });
  }
});

export default router;