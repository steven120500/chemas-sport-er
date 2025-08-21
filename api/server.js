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
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);
app.use(compression());

/* -------- CORS (debe ir ANTES de las rutas) -------- */
// Ajusta a la URL REAL de tu front (Render) y local
const ALLOWED = [
  'https://chemas-sport-er.onrender.com',
  'http://localhost:5173',
];

// Si prefieres abrirlo todo mientras pruebas, usa:  app.use(cors());
app.use(cors({
  origin: (origin, cb) => {
    // Permite herramientas sin Origin (curl, health checks, Render, etc.)
    if (!origin) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    // Si el front cambió de dominio, agrégalo arriba o temporalmente permite todos:
    // return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
  credentials: false,
  maxAge: 86400, // cache preflight 1 día
}));
// Por si algún proxy no reenviara OPTIONS
app.options('*', cors());

/* -------- body parsers -------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------- endpoints de salud (arriba) -------- */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => res.json({ message: 'API ok' }));

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
  console.error(err);
  // Importante: responder SIEMPRE con CORS, incluso en error
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- levantar -------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));