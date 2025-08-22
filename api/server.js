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

/* -------- ajustes generales -------- */
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);
app.use(compression());

/* -------- CORS (antes de rutas) -------- */
const ALLOWED_ORIGINS = [
  'https://chemas-sport-er.onrender.com',
  'http://localhost:5173',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // healthchecks/curl
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-user','x-roles','x-super'],
  credentials: false,
  maxAge: 86400,
}));
app.options('*', cors());

/* -------- body parsers -------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- health -------- */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

/* -------- DB y rutas -------- */
await connectDB();

app.use('/api/auth', authRoutes);
app.use('/api', pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);

/* -------- raíz -------- */
app.get('/', (_req, res) => res.send('Chema Sport ER API'));

/* -------- errores -------- */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- listen -------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));