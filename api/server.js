// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';

import connectDB from './config/db.js';

// RUTAS (puede que alguna esté exportando mal — por eso las inspeccionamos)
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js';

dotenv.config();

const app = express();

/* ---------------- Ajustes generales ---------------- */
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);
app.use(compression());

/* ---------------- Parche de diagnóstico ---------------- */
// Loggear todo montaje de middlewares/rutas.
const _use = app.use.bind(app);
app.use = (...args) => {
  const first = args[0];
  if (typeof first === 'string') {
    console.log('>> app.use(PATH):', first);
  } else {
    console.log('>> app.use(GLOBAL middleware)');
  }
  return _use(...args);
};

// Pequeña utilidad para inspeccionar routers antes de montarlos
function dumpRouter(label, r) {
  const type = typeof r;
  const name = r?.constructor?.name;
  const stackLen = Array.isArray(r?.stack) ? r.stack.length : 'n/a';
  console.log(`\n[ROUTER ${label}] typeof=${type} ctor=${name} stackLen=${stackLen}`);

  if (Array.isArray(r?.stack)) {
    try {
      const paths = r.stack
        .map(l => {
          // layer.route?.path para rutas, layer.regexp para middlewares montados dentro
          const p = l?.route?.path ?? l?.regexp?.toString?.() ?? '(layer)';
          const methods = l?.route ? Object.keys(l.route.methods || {}) : [];
          return `${methods.join(',').toUpperCase() || 'MW'}  ${p}`;
        })
        .slice(0, 50); // no spamear
      console.log(`[ROUTER ${label}] layers:\n - ` + paths.join('\n - '));
    } catch (e) {
      console.log(`[ROUTER ${label}] error al listar stack:`, e.message);
    }
  } else {
    console.log(`[ROUTER ${label}] no tiene stack (¿export default router faltante?)`);
  }
}

/* ---------------- CORS (antes de rutas) ---------------- */
const ALLOWED_ORIGINS = [
  'https://chemasport-er.onrender.com', // tu front en Render (sin guion)
  'http://localhost:5173',               // dev local
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/healthchecks
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    console.warn('CORS bloqueado para Origin:', origin);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
  credentials: false,
  maxAge: 86400,
}));

/* ---------------- Body parsers ---------------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- Endpoints de salud ---------------- */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

/* ---------------- Conectar DB antes de rutas ---------------- */
await connectDB();

/* ---------------- DUMPs de routers antes de montar ---------------- */
dumpRouter('authRoutes', authRoutes);
dumpRouter('pdfRoutes', pdfRoutes);
dumpRouter('historyRoutes', historyRoutes);
dumpRouter('productRoutes', productRoutes);

/* ---------------- Montaje de rutas (con try/catch) ---------------- */
try {
  app.use('/api/auth', authRoutes);
  console.log('Montado: /api/auth');
} catch (e) {
  console.error('Fallo montando /api/auth:', e);
}

try {
  app.use('/api', pdfRoutes);
  console.log('Montado: /api (pdfRoutes)');
} catch (e) {
  console.error('Fallo montando /api (pdfRoutes):', e);
}

try {
  app.use('/api/history', historyRoutes);
  console.log('Montado: /api/history');
} catch (e) {
  console.error('Fallo montando /api/history:', e);
}

try {
  app.use('/api/products', productRoutes);
  console.log('Montado: /api/products');
} catch (e) {
  console.error('Fallo montando /api/products:', e);
}

/* ---------------- Raíz opcional ---------------- */
app.get('/', (_req, res) => res.send('Chema Sport ER API'));

/* ---------------- Manejo de errores ---------------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error('ERROR middleware:', err.stack || err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* ---------------- Levantar ---------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));