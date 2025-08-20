// routes/historyroutes.js
import express from 'express';
import History from '../models/History.js';

const router = express.Router();

/* ---------- helpers de permisos ---------- */
function getRoles(req) {
  const raw = req.headers['x-roles'] || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
function isSuper(req) {
  // header "x-super":"true" o flag en req.user (si lo agregas por middleware)
  return req.user?.isSuperUser || req.headers['x-super'] === 'true';
}

/* ---------- helper de rango por día ---------- */
/** Devuelve { $gte: startUTC, $lt: nextUTC } para una fecha YYYY-MM-DD */
function dayRange(dateStr) {
  if (!dateStr) return null;
  // Interpretamos el string como fecha "local" y lo convertimos a UTC boundaries
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(start.getTime())) return null;
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { $gte: start, $lt: next };
}

/* ========== GET: ver historial (con filtro por día) ========== */
// Permite: superadmin o rol "history"
router.get('/', async (req, res) => {
  try {
    if (!(isSuper(req) || getRoles(req).includes('history'))) {
      return res.status(403).json({ message: 'No autorizado a ver historial' });
    }

    const { date, q } = req.query; // ?date=YYYY-MM-DD  |  ?q=texto (opcional)

    const find = {};
    // filtro por rango de día
    const range = dayRange(date);
    if (range) find.date = range;

    // filtro opcional por texto en item o action
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i');
      find.$or = [{ item: rx }, { action: rx }, { user: rx }];
    }

    const logs = await History.find(find)
      .sort({ date: -1 })
      .lean();

    res.json(logs);
  } catch (err) {
    console.error('Error al obtener historial:', err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

/* ========== DELETE: limpiar historial (solo super) ========== */
router.delete('/', async (req, res) => {
  try {
    if (!isSuper(req)) {
      return res.status(403).json({ message: 'Solo superadmin puede limpiar historial' });
    }
    await History.deleteMany({});
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al limpiar historial:', err);
    res.status(500).json({ error: 'Error al limpiar historial' });
  }
});

export default router;