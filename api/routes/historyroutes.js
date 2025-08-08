import express from 'express';
import History from '../models/History.js';   // tu modelo

const router = express.Router();

// opcional: proteger con middleware de auth
// router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const logs = await History.find().sort({ date: -1 }).limit(50).lean();
    res.json(logs);
  } catch (err) {
    console.error('Error history:', err);
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
});

export default router;