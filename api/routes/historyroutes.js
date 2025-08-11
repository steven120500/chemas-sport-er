import express from 'express';
import History from '../models/History.js';

const router = express.Router();

function getRoles(req) {
  const raw = req.headers['x-roles'] || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
function isSuper(req) {
  return req.user?.isSuperUser || req.headers['x-super'] === 'true';
}

// ✅ Ver historial: superadmin o rol "history"
router.get('/', (req, res, next) => {
  if (isSuper(req) || getRoles(req).includes('history')) return next();
  return res.status(403).json({ message: 'No autorizado a ver historial' });
}, async (_req, res) => {
  const logs = await History.find().sort({ date: -1 }).lean();
  res.json(logs);
});

// 🗑 Limpiar historial: solo superadmin
router.delete('/', (req, res, next) => {
  if (isSuper(req)) return next();
  return res.status(403).json({ message: 'Solo superadmin puede limpiar historial' });
}, async (_req, res) => {
  await History.deleteMany({});
  res.json({ ok: true });
});

export default router;