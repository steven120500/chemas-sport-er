// api/server.js
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

/* -------- CORS -------- */
const ALLOWED_ORIGINS = [
  'https://chemasport-er.onrender.com',  // <— TU FRONT
  'http://localhost:5173',
];
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // permite probar directo en el navegador/curl
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));

/* -------- Body parsers -------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- Endpoints de salud -------- */
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));
app.get('/api/ping',   (_req, res) => res.json({ message: 'API ok' }));

/* -------- Conexión DB -------- */
await connectDB();

/* -------- Rutas -------- */
app.use('/api/auth', authRoutes);
app.use('/api',      pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);

/* -------- Endpoint “humo” por si dudas de la ruta --------
   Abre en el navegador: https://<tu-back>/api/products/health
*/
app.get('/api/products/health', (_req, res) => res.json({ ok: true }));

/* -------- Raíz -------- */
app.get('/', (_req, res) => res.send('ok'));

/* -------- 404 y 500 -------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- Levantar -------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('UP on', PORT));