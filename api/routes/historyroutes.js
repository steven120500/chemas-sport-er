import express from 'express';
import History from '../models/History.js';

const router = express.Router();

/* =============================== GET LIST ============================== */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    
    const q         = (req.query.q || '').trim();
    const userParam = (req.query.user || '').trim();
    const store     = (req.query.store || '').trim();
    const startDate = (req.query.startDate || '').trim();
    const endDate   = (req.query.endDate || '').trim();
    const month     = (req.query.month || '').trim();

    // Si hay un filtro activo, permitimos que el límite suba hasta 1000
    const isFiltering = Boolean(q || userParam || store || startDate || endDate || month);
    const defaultLimit = isFiltering ? 1000 : 30;
    const limit = Math.min(Math.max(parseInt(req.query.limit || String(defaultLimit), 10), 1), 3000);

    // 🔥 USAMOS UN ARREGLO $and PARA QUE NINGÚN FILTRO CHOQUE CON OTRO 🔥
    const andConditions = [];

    /* ⭐ 1. BUSCADOR INTEGRAL (Camiseta, Cliente, Acción o Vendedor) ⭐ */
    if (q) {
      andConditions.push({
        $or: [
          { item: { $regex: q, $options: 'i' } },
          { details: { $regex: q, $options: 'i' } }, // 👈 ENCUENTRA AL CLIENTE AQUÍ
          { action: { $regex: q, $options: 'i' } },
          { user: { $regex: q, $options: 'i' } }
        ]
      });
    }

    /* ⭐ 2. FILTRO POR EMPLEADO (USUARIO) ⭐ */
    if (userParam) {
      andConditions.push({ user: userParam });
    }

    /* ⭐ 3. FILTRO POR TIENDA ⭐ */
    if (store) {
      andConditions.push({ details: { $regex: store, $options: 'i' } });
    }

    /* ⭐ 4. FILTRO POR FECHAS O MES ⭐ */
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      andConditions.push({ date: dateQuery });
    } else if (month) {
      // Formato esperado: YYYY-MM (ej: 2026-07)
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const end = new Date(y, m, 0, 23, 59, 59, 999);
        andConditions.push({ date: { $gte: start, $lte: end } });
      }
    }

    // Construimos la consulta final limpiamente
    const find = andConditions.length > 0 ? { $and: andConditions } : {};

    const [items, total] = await Promise.all([
      History.find(find)
        .sort({ date: -1 }) // Los más recientes primero
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      History.countDocuments(find),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    });

  } catch (err) {
    console.error('GET /api/history error:', err);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
});

/* ============================ DELETE HISTORY =========================== */
router.delete('/', async (req, res) => {
  try {
    const isSuper = req.headers['x-super'] === 'true';
    if (!isSuper) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar el historial' });
    }

    await History.deleteMany({});
    res.json({ message: 'Historial eliminado correctamente' });
  } catch (err) {
    console.error('DELETE /api/history error:', err);
    res.status(500).json({ error: 'Error al eliminar el historial' });
  }
});

export default router;