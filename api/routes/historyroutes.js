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

/* ---------- helper: rango por día en hora local de Costa Rica ---------- */
/**
 * Devuelve un filtro { $gte: startUTC, $lt: endUTC } correspondiente al día
 * 'YYYY-MM-DD' en hora local de Costa Rica (UTC-6, sin DST).
 *
 * Ej.: si dateStr = '2025-08-25', el rango cubre
 *  2025-08-25 00:00:00.000 (CR)  ->  2025-08-25 23:59:59.999 (CR),
 * expresado en UTC para guardar/consultar en Mongo.
 */
function crDayRange(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  // Costa Rica es UTC-6 todo el año
  const CR_OFFSET_MIN = 6 * 60;

  const [y, m, d] = dateStr.split('-').map(Number);
  // 00:00 CR equivale a +6h UTC
  const startUTC = new Date(Date.UTC(y, m - 1, d, CR_OFFSET_MIN / 60, 0, 0, 0));
  // Fin del día CR: sumar 24h y restar 1 ms
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  return { $gte: startUTC, $lt: endUTC };
}

router.get('/', async (req, res) => {
  try {
    const { date, page = '1', limit = '200', q = '' } = req.query;

    // Si no viene date, usamos el día de hoy en CR
    let usedDate = date;
    if (!usedDate) {
      const now = new Date();
      // Formatear hoy local (del servidor) como YYYY-MM-DD
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');
      usedDate = `${y}-${m}-${d}`;
    }

    const range = crDayRange(String(usedDate));
    const find = {};
    if (range) find.date = range;

    const term = String(q || '').trim();
    if (term) find.item = { $regex: term, $options: 'i' };

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

    const [items, total] = await Promise.all([
      History.find(find).sort({ date: -1 }).skip((p - 1) * l).limit(l).lean(),
      History.countDocuments(find),
    ]);

    res.json({
      items,
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / l)),
      limit: l,
    });
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