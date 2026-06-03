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
  return req.user?.isSuperUser || req.headers['x-super'] === 'true';
}

/* ---------- helper: Inicio de día en Costa Rica (UTC-6) ---------- */
function getStartOfCRDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // 00:00 CR equivale a +6h en UTC
  return new Date(Date.UTC(y, m - 1, d, 6, 0, 0, 0));
}

router.get('/', async (req, res) => {
  try {
    // 1. Recibimos los nuevos parámetros del frontend
    const { date, startDate, endDate, month, page = '1', limit = '200', q = '' } = req.query;

    const find = {};

    // 2. Lógica de Filtros por Fechas (Respetando Hora de Costa Rica)
    if (startDate || endDate) {
      find.date = {};
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        find.date.$gte = getStartOfCRDay(startDate); // Desde las 00:00 CR
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        const end = getStartOfCRDay(endDate);
        end.setDate(end.getDate() + 1); // Hasta las 23:59:59 (sumando 1 día exacto)
        find.date.$lt = end;
      }
    } 
    else if (month && /^\d{4}-\d{2}$/.test(month)) {
      // Si el frontend manda un mes entero (ej: "2026-06")
      const [y, m] = month.split('-').map(Number);
      const startUTC = new Date(Date.UTC(y, m - 1, 1, 6, 0, 0, 0)); // Día 1 a las 00:00 CR
      const endUTC = new Date(Date.UTC(y, m, 1, 6, 0, 0, 0)); // Día 1 del SIGUIENTE mes a las 00:00 CR
      find.date = { $gte: startUTC, $lt: endUTC };
    } 
    else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Retrocompatibilidad por si llega a mandar un solo día
      const start = getStartOfCRDay(date);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      find.date = { $gte: start, $lt: end };
    }

    // 3. Filtro por término de búsqueda
    const term = String(q || '').trim();
    if (term) find.item = { $regex: term, $options: 'i' };

    const p = Math.max(parseInt(page, 10) || 1, 1);
    // ⭐ SUBIMOS EL LÍMITE A 3000 para que el frontend pueda hacer sus cálculos matemáticos correctamente
    const l = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 3000);

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
