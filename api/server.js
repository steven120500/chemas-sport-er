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
app.disable('x-powered-by');           // seguridad
app.set('json spaces', 0);             // respuestas JSON compactas
app.set('trust proxy', 1);             // útil en Render/Proxies
app.use(compression());                // gzip/brotli

/* -------- CORS (debe ir ANTES de las rutas) -------- */
const ALLOWED_ORIGINS = [
  'https://chemas-sport-er.onrender.com', // tu front en Render
  'http://localhost:5173',                 // desarrollo local
];

app.use(
  cors({
    origin: (origin, cb) => {
      // permitir herramientas sin Origin (curl, healthchecks)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user'],
    credentials: false, // pon true solo si usas cookies/sesiones
    maxAge: 86400,      // cachea preflight por 1 día
  })
);
// por si algún proxy no reenvía OPTIONS correctamente
app.options('*', cors());

/* -------- body parsers -------- */
// si no envías imágenes en el body, 10MB es suficiente
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- endpoints livianos de salud (arriba) -------- */
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