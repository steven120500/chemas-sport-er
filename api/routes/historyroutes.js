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

router.get('/', async (req, res) => {
  try {
    const { date, page = '1', limit = '200' } = req.query;

    // rango del día en UTC (evita problemas de TZ)
    const find = {};
    const day = (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) 
                ? new Date(`${date}T00:00:00.000Z`)
                : new Date(new Date().toISOString().slice(0,10) + 'T00:00:00.000Z');

    const start = day;                          // 00:00 UTC
    const end   = new Date(start.getTime() + 24*60*60*1000); // 24h después
    find.date = { $gte: start, $lt: end };

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

    const [items, total] = await Promise.all([
      History.find(find).sort({ date: -1 }).skip((p-1)*l).limit(l).lean(),
      History.countDocuments(find),
    ]);

    res.json({ items, total, page: p, pages: Math.max(1, Math.ceil(total/l)), limit: l });
  } catch (e) {
    console.error('history GET error:', e);
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