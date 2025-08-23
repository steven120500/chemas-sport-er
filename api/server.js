// api/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';

import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js'; // <= OJO: H mayúscula

dotenv.config();

const app = express();

/* -------- Ajustes -------- */
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);
app.use(compression());

/* -------- CORS (temporal, abierto) -------- */
app.use(cors({
  origin: (origin, cb) => cb(null, true),   // permite cualquier origen mientras probamos
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-user','x-roles','x-super'],
  credentials: false,
  maxAge: 86400,
}));

/* -------- Parsers -------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- Salud -------- */
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));
app.get('/api/ping',   (_req, res) => res.json({ message: 'API ok' }));

/* -------- Conectar DB -------- */
await connectDB();

/* -------- Helper para loggear rutas montadas -------- */
function mount(prefix, router, label) {
  console.log(`Montando ${prefix} (${label})`);
  app.use(prefix, (req, _res, next) => {
    console.log(`[HIT] ${req.method} ${req.originalUrl}`);
    next();
  }, router);
}

/* -------- Rutas -------- */
mount('/api/auth',     authRoutes,    'authRoutes');
mount('/api/pdf',      pdfRoutes,     'pdfRoutes');
mount('/api/history',  historyRoutes, 'historyRoutes');
mount('/api/products', productRoutes, 'productRoutes');

// “humo” para probar desde el navegador
app.get('/api/products/health', (_req, res) => res.json({ ok: true }));

/* -------- Raíz -------- */
app.get('/', (_req, res) => res.send('ok'));

/* -------- 404 / 500 -------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- Levantar -------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));