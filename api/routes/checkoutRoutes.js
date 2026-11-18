// routes/checkoutRoutes.js
// 🛒 Rutas PÚBLICAS del checkout de la tienda online (el cliente no tiene sesión).
// ⚠️ Todo lo que se agregue acá es público: limitar por IP y devolver solo lo mínimo.
// Próximo paso: POST /api/checkout (crear orden + link de pago Tilopay; llaves solo en .env).
import express from 'express';
import { rateLimit } from '../middleware/auth.js';

const router = express.Router();

// 🔍 Cache en memoria de cédulas consultadas (evita repetir llamadas al escribir/borrar)
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map(); // cedula -> { data, exp }

const limpiarCache = () => {
  if (cache.size <= CACHE_MAX) return;
  const sobran = cache.size - CACHE_MAX;
  let i = 0;
  for (const k of cache.keys()) {
    if (i++ >= sobran) break;
    cache.delete(k);
  }
};

const fetchConTimeout = async (url, ms = 6000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(t);
  }
};

const titulo = (s = '') =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s|-)(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase());

// 1️⃣ Padrón del TSE vía GoMeta (personas físicas, actualizado casi a diario)
async function buscarTSE(cedula) {
  const r = await fetchConTimeout(`https://apis.gometa.org/cedulas/${cedula}`);
  if (!r.ok) return null;
  const data = await r.json();
  const p = Array.isArray(data?.results) ? data.results[0] : null;
  if (!p) return null;
  const nombre = p.firstname || p.firstname1 || '';
  const apellidos = [p.lastname1, p.lastname2].filter(Boolean).join(' ') || p.lastname || '';
  if (!nombre && !apellidos) return p.fullname ? { nombre: titulo(p.fullname), apellidos: '', fuente: 'tse' } : null;
  return { nombre: titulo(nombre), apellidos: titulo(apellidos), fuente: 'tse' };
}

// 2️⃣ Hacienda (contribuyentes: jurídicas, DIMEX, personas inscritas). Solo trae el nombre completo.
async function buscarHacienda(cedula) {
  const r = await fetchConTimeout(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedula}`);
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.nombre) return null;
  const tipo = String(data?.tipoIdentificacion || '');
  // Jurídica (02): todo es razón social, va en "nombre"
  if (tipo === '02') return { nombre: titulo(data.nombre), apellidos: '', fuente: 'hacienda' };
  // Física: Hacienda devuelve "APELLIDO1 APELLIDO2 NOMBRE(S)"
  const partes = titulo(data.nombre).split(' ');
  if (partes.length >= 3) return { nombre: partes.slice(2).join(' '), apellidos: partes.slice(0, 2).join(' '), fuente: 'hacienda' };
  return { nombre: titulo(data.nombre), apellidos: '', fuente: 'hacienda' };
}

/* ========================================================
   🔍 GET /api/checkout/cedula/:cedula → { encontrado, nombre, apellidos, fuente }
   Pública + limitada (30 consultas / 15 min por IP). No toca la BD ni los contactos de Alegra.
   ======================================================== */
router.get(
  '/cedula/:cedula',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Demasiadas consultas de cédula. Probá en unos minutos.' }),
  async (req, res) => {
    const cedula = String(req.params.cedula || '').replace(/\D/g, '');
    if (!/^\d{9,12}$/.test(cedula)) return res.status(400).json({ error: 'Cédula inválida.' });

    const enCache = cache.get(cedula);
    if (enCache && enCache.exp > Date.now()) return res.json(enCache.data);

    try {
      let r = null;
      // Físicas nacionales (9 dígitos) → TSE primero; el resto → Hacienda primero
      const orden = cedula.length === 9 ? [buscarTSE, buscarHacienda] : [buscarHacienda, buscarTSE];
      for (const fn of orden) {
        try {
          r = await fn(cedula);
        } catch (e) {
          console.warn(`⚠️ Consulta de cédula (${fn.name}) falló:`, e.message);
        }
        if (r) break;
      }

      const data = r ? { encontrado: true, ...r } : { encontrado: false };
      cache.set(cedula, { data, exp: Date.now() + (r ? CACHE_MS : 60 * 60 * 1000) });
      limpiarCache();
      res.json(data);
    } catch (error) {
      console.error('❌ Error consultando cédula:', error);
      res.status(500).json({ error: 'No se pudo consultar la cédula.' });
    }
  }
);

export default router;
