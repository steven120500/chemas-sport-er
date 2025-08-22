// server.js
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js';

dotenv.config();

const app = express();

/* ------------ básicos ------------ */
app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);

/* ------------ middlewares ------------ */
app.use(compression());

const ALLOWED_ORIGINS = [
  'https://chemasport-er.onrender.com',
  'http://localhost:5173',
];

// CORS principal
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/healthchecks
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-user', 'x-roles', 'x-super'],
    credentials: false,
    maxAge: 86400,
  })
);

// ✅ Respuesta manual a preflight (evita usar app.options('*', cors()))
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user, x-roles, x-super');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.sendStatus(204);
    }
    return res.sendStatus(403);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ------------ health ------------ */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});
app.get('/api/ping', (_req, res) => res.json({ message: 'API ok' }));

// raíz para probar rápido en el navegador
app.get('/', (_req, res) => res.type('text/plain').send('ok'));

/* ------------ DB y rutas ------------ */
await connectDB();

app.use('/api/auth', authRoutes);
app.use('/api', pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);

/* ------------ 404 y errores ------------ */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* ------------ levantar ------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log('Rutas: /, /api/health, /api/ping, /api/products, /api/auth, /api/history');
});