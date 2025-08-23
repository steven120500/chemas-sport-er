// api/server.js
import express from 'express';
import dotenv from 'dotenv';
import compression from 'compression';

// Rutas y DB
import connectDB from './config/db.js';
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

/* ---------------- CORS PERMISIVO (fix preflight) ----------------
   Si luego quieres restringir, cambia la primera línea a un ORIGIN concreto.
   Este bloque corre ANTES de cualquier ruta para garantizar los headers. */
app.use((req, res, next) => {
  // Permite a tu Front en Render (ajústalo si usas dominio propio)
  const FRONT = 'https://chemasport-er.onrender.com';
  res.setHeader('Access-Control-Allow-Origin', FRONT);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-user, x-roles, x-super'
  );
  // Si el navegador hace preflight, respondemos aquí
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------------- Parsers ---------------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- Endpoints de salud rápidos ---------------- */
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));
app.get('/api/ping', (_req, res) => res.json({ message: 'API ok' }));

/* ---------------- Conexión a MongoDB ---------------- */
await connectDB();

/* ---------------- Helper para loggear rutas montadas ---------------- */
function mount(prefix, router, label) {
  console.log(`Montando ${prefix} (${label})`);
  app.use(prefix, (req, _res, next) => {
    // pequeño rastro de hits
    console.log(`[HIT] ${req.method} ${req.originalUrl}`);
    next();
  }, router);
}

/* ---------------- Rutas ---------------- */
mount('/api/auth',    authRoutes,     'authRoutes');
mount('/api/pdf',     pdfRoutes,      'pdfRoutes');
mount('/api/history', historyRoutes,  'historyRoutes');
mount('/api/products', productRoutes, 'productRoutes');

/* --- “Humo” para probar desde el navegador que /api/products está vivo --- */
app.get('/api/products/health', (_req, res) => res.json({ ok: true }));

/* ---------------- Raíz ---------------- */
app.get('/', (_req, res) => res.send('ok'));

/* ---------------- 404 y 500 ---------------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* ---------------- Levantar ---------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Servidor corriendo en puerto', PORT));