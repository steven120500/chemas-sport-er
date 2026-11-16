// routes/comisionesRoutes.js
// 🗓️ Contrapedidos de comisiones, guardados en la BD para que todos los dispositivos vean lo mismo.
// Ver: cualquier sesión. Modificar: súper usuario o los usuarios de CONTRAPEDIDOS_USUARIOS (por defecto Johanna).
import express from 'express';
import Contrapedido from '../models/Contrapedido.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const MES_RX = /^\d{4}-\d{2}$/;
const sinTildes = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function puedeEditar(user) {
  if (!user?.id) return false;
  if (user.isSuperUser) return true;
  const lista = (process.env.CONTRAPEDIDOS_USUARIOS || 'johanna,johana').split(',').map(sinTildes).filter(Boolean);
  return lista.includes(sinTildes(user.name));
}

/** Acepta { semanas: [...] } o un número viejo (acumulado en la semana 1) → array de 4–5 enteros >= 0 */
function limpiarSemanas(valor) {
  const crudo = Array.isArray(valor?.semanas) ? valor.semanas : Array.isArray(valor) ? valor : [valor, 0, 0, 0];
  const n = Math.min(5, Math.max(4, crudo.length));
  return Array.from({ length: n }, (_, i) => {
    const x = Math.trunc(Number(crudo[i]) || 0);
    return x > 0 ? Math.min(x, 100000) : 0;
  });
}

/** { [mes]: { [vendedor]: { semanas } } } — mismo formato que usaba el localStorage */
async function mapaCompleto() {
  const docs = await Contrapedido.find({}).lean();
  const mapa = {};
  for (const d of docs) {
    (mapa[d.mes] ||= {})[d.vendedor] = { semanas: d.semanas };
  }
  return mapa;
}

// GET /api/comisiones/contrapedidos
router.get('/contrapedidos', async (_req, res) => {
  try {
    res.json(await mapaCompleto());
  } catch (err) {
    console.error('Error al cargar contrapedidos:', err);
    res.status(500).json({ error: 'No se pudieron cargar los contrapedidos.' });
  }
});

// PUT /api/comisiones/contrapedidos  { mes, vendedor, semanas }
router.put('/contrapedidos', async (req, res) => {
  try {
    if (!puedeEditar(req.user)) return res.status(403).json({ error: 'No tenés permisos para modificar los contrapedidos.' });
    const mes = String(req.body?.mes || '');
    const vendedor = String(req.body?.vendedor || '').trim().slice(0, 100);
    if (!MES_RX.test(mes) || !vendedor) return res.status(400).json({ error: 'Mes o vendedor inválido.' });
    const semanas = limpiarSemanas({ semanas: req.body?.semanas });
    await Contrapedido.findOneAndUpdate(
      { mes, vendedor },
      { $set: { semanas, actualizadoPor: req.user.name || '' } },
      { upsert: true, new: true }
    );
    const mapa = await mapaCompleto();
    res.json(mapa);
  } catch (err) {
    console.error('Error al guardar contrapedido:', err);
    res.status(500).json({ error: 'No se pudo guardar el contrapedido.' });
  }
});

// POST /api/comisiones/contrapedidos/importar  { datos: { [mes]: { [vendedor]: valor } } }
// Sube lo que había en el localStorage de un dispositivo. Solo agrega lo que la BD todavía no tiene (no pisa nada).
router.post('/contrapedidos/importar', async (req, res) => {
  try {
    if (!puedeEditar(req.user)) return res.status(403).json({ error: 'No tenés permisos para modificar los contrapedidos.' });
    const datos = req.body?.datos;
    if (!datos || typeof datos !== 'object') return res.status(400).json({ error: 'Datos inválidos.' });
    const ops = [];
    for (const [mes, porVendedor] of Object.entries(datos)) {
      if (!MES_RX.test(mes) || !porVendedor || typeof porVendedor !== 'object') continue;
      for (const [vendedorCrudo, valor] of Object.entries(porVendedor)) {
        const vendedor = String(vendedorCrudo).trim().slice(0, 100);
        const semanas = limpiarSemanas(valor);
        if (!vendedor || semanas.every((x) => x === 0)) continue;
        ops.push({
          updateOne: {
            filter: { mes, vendedor },
            update: { $setOnInsert: { mes, vendedor, semanas, actualizadoPor: req.user.name || '' } },
            upsert: true,
          },
        });
      }
    }
    if (ops.length > 500) return res.status(400).json({ error: 'Demasiados datos.' });
    if (ops.length) await Contrapedido.bulkWrite(ops, { ordered: false });
    const mapa = await mapaCompleto();
    res.json(mapa);
  } catch (err) {
    console.error('Error al importar contrapedidos:', err);
    res.status(500).json({ error: 'No se pudieron importar los contrapedidos.' });
  }
});

export default router;
