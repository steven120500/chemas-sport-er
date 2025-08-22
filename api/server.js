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

/* ------------ Ajustes generales ------------ */
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);

/* ------------ Middlewares globales ------------ */
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ------------ CORS (antes de las rutas) ------------ */
const ALLOWED_ORIGINS = [
  'https://chemasport-er.onrender.com', // FRONT en Render (sin guion)
  'http://localhost:5173',               // dev local (Vite)
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite herramientas sin Origin (health checks, curl)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
    credentials: false,
    maxAge: 86400, // cachea preflight por 1 día
  })
);


/* ------------ Health checks ligeros ------------ */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

/* ------------ Conectar BD antes de montar rutas ------------ */
await connectDB();

/* ------------ Rutas de la app ------------ */
app.use('/api/auth', authRoutes);
app.use('/api', pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);

/* ------------ Raíz (opcional) ------------ */
app.get('/', (_req, res) => res.send('Chema Sport ER API'));

/* ------------ Manejo de errores ------------ */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* ------------ Levantar servidor ------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});