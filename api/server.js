// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';

import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js';

dotenv.config();

const app = express();

/* -------- Ajustes generales -------- */
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);
app.use(compression());

/* -------- CORS (ANTES de las rutas) -------- */
const ALLOWED_ORIGINS = [
  'https://chemasport-er.onrender.com',
  'http://localhost:5173',
];

app.use(
  cors({
    origin(origin, cb) {
      // Permite healthchecks/cURL (sin Origin)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
    credentials: false,
    maxAge: 86400,
  })
);

/* -------- Body parsers -------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- Endpoints de salud -------- */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

/* -------- Conectar DB ANTES de las rutas -------- */
await connectDB();

/* ====== DIAGNÓSTICO: listar rutas montadas ====== */
function listRoutes(appInstance) {
  const out = [];
  const stack = appInstance._router?.stack || [];
  stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      out.push(`${methods} ${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle?.stack) {
      layer.handle.stack.forEach((h) => {
        if (h.route?.path) {
          const methods = Object.keys(h.route.methods).join(',').toUpperCase();
          out.push(`[router] ${methods} ${h.route.path}`);
        }
      });
    }
  });
  console.log('>> Rutas registradas al inicio:\n' + out.join('\n'));
}

/* ====== (Temporal) PRUEBA: /api/products directo ======
   Esto asegura que /api/products responde algo aunque falle el router.
   Cuando verifiques que productRoutes responde, puedes borrar este bloque. */
app.get('/api/products', (_req, res) => {
  res.json({ ok: true, from: 'server.js (temporal /api/products)' });
});
/* ====== Fin PRUEBA temporal ====== */

/* -------- Rutas de la app -------- */
console.log('Montando /api/auth');
app.use('/api/auth', authRoutes);

console.log('Montando /api (pdfRoutes)');
app.use('/api', pdfRoutes);

console.log('Montando /api/history');
app.use('/api/history', historyRoutes);

console.log('Montando /api/products');
app.use('/api/products', productRoutes); // <— aquí debe montarse el router real

listRoutes(app);

/* -------- Raíz -------- */
app.get('/', (_req, res) => res.send('Chema Sport ER API'));

/* -------- Manejo de errores (al final) -------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error('ERROR:', err.stack || err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- Levantar -------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));