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
    const type      = (req.query.type || '').trim(); 
    const startDate = (req.query.startDate || '').trim();
    const endDate   = (req.query.endDate || '').trim();
    const month     = (req.query.month || '').trim();

    // Si hay un filtro activo, permitimos que el límite suba hasta 1000
    const isFiltering = Boolean(q || userParam || store || type || startDate || endDate || month);
    const defaultLimit = isFiltering ? 1000 : 30;
    const limit = Math.min(Math.max(parseInt(req.query.limit || String(defaultLimit), 10), 1), 3000);

    const andConditions = [];

    /* ⭐ 1. BUSCADOR INTEGRAL (Camiseta, Cliente, Acción o Vendedor) ⭐ */
    if (q) {
      andConditions.push({
        $or: [
          { item: { $regex: q,$options: 'i' } },
          { details: { $regex: q,$options: 'i' } },
          { action: { $regex: q,$options: 'i' } },
          { user: { $regex: q,$options: 'i' } }
        ]
      });
    }

    /* ⭐ 2. FILTRO POR EMPLEADO (USUARIO) ⭐ */
    if (userParam) {
      andConditions.push({ user: userParam });
    }

    /* ⭐ 3. FILTRO POR TIENDA ⭐ */
    if (store) {
      andConditions.push({ details: { $regex: store,$options: 'i' } });
    }

    /* ⭐ 4. FILTRO POR TIPO DE ARTÍCULO ⭐ */
    if (type) {
      andConditions.push({ item: { $regex: `\\(${type}\\)`, $options: 'i' } });
    }

    /* ⭐ 5. FILTRO POR FECHAS O MES (CORREGIDO PARA COSTA RICA UTC-6) ⭐ */
    if (startDate || endDate) {
      const dateQuery = {};
      
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        // 00:00:00 en Costa Rica = 06:00:00 UTC
        dateQuery.$gte = new Date(Date.UTC(y, m - 1, d, 6, 0, 0, 0));
      }
      
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        // 23:59:59 en Costa Rica = 05:59:59 UTC del DÍA SIGUIENTE (+1 al día)
        dateQuery.$lte = new Date(Date.UTC(y, m - 1, d + 1, 5, 59, 59, 999));
      }
      andConditions.push({ date: dateQuery });
      
    } else if (month) {
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        // Inicio de mes en CR (Día 1 a las 00:00) -> Día 1 a las 06:00 UTC
        const start = new Date(Date.UTC(y, m - 1, 1, 6, 0, 0, 0));
        
        // Fin de mes en CR (Último día a las 23:59) -> Día 1 del siguiente mes a las 05:59 UTC
        const end = new Date(Date.UTC(y, m, 1, 5, 59, 59, 999));
        
        andConditions.push({ date: { $gte: start,$lte: end } });
      }
    }

    const find = andConditions.length > 0 ? { $and: andConditions } : {};

    const [items, total] = await Promise.all([
      History.find(find)
        .sort({ date: -1 })
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