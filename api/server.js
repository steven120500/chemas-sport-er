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

/* -------- ajustes generales -------- */
app.disable('x-powered-by');        // seguridad
app.set('json spaces', 0);          // respuestas JSON compactas
app.set('trust proxy', 1);          // útil en Render/Proxies

/* ===== Parche de diagnóstico: loguea cada app.use(path, ...) ===== */
const _use = app.use.bind(app);
app.use = (...args) => {
  const first = args[0];
  if (typeof first === 'string') {
    console.log('Montando ruta:', first);
  } else {
    console.log('Montando middleware sin path (global).');
  }
  return _use(...args);
};
/* ===== Fin parche diagnóstico ===== */

/* -------- middlewares globales -------- */
app.use(compression());

/* -------- CORS (ajusta tu dominio del front) -------- */
const ALLOWED_ORIGINS = [
  'https://chemasport-er.onrender.com', // tu front en Render (sin guion)
  'http://localhost:5173',              // dev local
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite herramientas sin Origin (curl, healthchecks, etc.)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
    credentials: false,
    maxAge: 86400, // cache preflight 1 día
  })
);
// asegura respuesta a preflight aunque algún proxy no reenvíe bien
app.options('*', cors());

/* -------- body parsers -------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- endpoints de salud -------- */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

/* -------- conectar DB ANTES de montar rutas -------- */
await connectDB();

/* -------- rutas de la app -------- */
app.use('/api/auth', authRoutes);
app.use('/api', pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);

/* -------- raíz (opcional) -------- */
app.get('/', (_req, res) => res.send('Chema Sport ER API'));

/* -------- manejo de errores -------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- levantar -------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));