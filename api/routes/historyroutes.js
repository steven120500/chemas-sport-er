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

// DELETE historial (solo superusuario si quieres)
router.delete('/', async (req, res) => {
  try {
    // Si ya tienes auth y quieres restringir:
    // if (!req.user?.isSuperUser) return res.status(403).json({ error: 'Solo súper usuario' });

    const r = await History.deleteMany({});
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo limpiar el historial' });
  }
});

export default router;