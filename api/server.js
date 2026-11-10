// Debe ir PRIMERO: carga el .env antes de que se evalúen los módulos de rutas (leen process.env al importarse)
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import connectDB from './config/db.js';

import attachUser from './middleware/attachUser.js';
import { socketAuth, onSocketConnection } from './utils/realtime.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js';
import saleRoutes from './routes/saleRoutes.js';
import alegraRoutes from './routes/alegraRoutes.js'; 
import guiasRoutes from './routes/guiasRoutes.js';   
import tiendaRoutes from './routes/tiendaRoutes.js'; 
import correosRoutes from './routes/correosRoutes.js'; // 👈 1. IMPORTAR RUTA DE CORREOS CR

const app = express();

app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);

app.use(compression());

// Headers de seguridad. CORP "cross-origin" porque el frontend vive en otro dominio.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

if (!process.env.JWT_SECRET) {
  console.error('⚠️  Falta JWT_SECRET en las variables de entorno: nadie va a poder iniciar sesión.');
}

// Guardamos los dominios permitidos
const allowedOrigins = [
  'https://chemasport-er.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  "https://chemasporter.com",           
  "https://www.chemasporter.com"
];

// localhost en cualquier puerto (desarrollo). No es un riesgo: los permisos dependen del token, no del origen.
const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin);
const corsOrigin = (origin, cb) => cb(null, isAllowedOrigin(origin));

// ⭐ CORS DE EXPRESS
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-admin', 'x-super', 'x-roles']
}));

// Límite para fotos en base64 del editor (ya llegan comprimidas; 15 MB cubre el peor caso)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

/* 👇 CONFIGURACIÓN DE WEBSOCKETS 👇 */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-admin', 'x-super', 'x-roles']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

// Los clientes con token válido entran a la sala "admins" (reciben datos completos);
// el catálogo público recibe la versión sin datos internos (ver utils/realtime.js).
io.use(socketAuth);
io.on('connection', onSocketConnection);
/* 👆 FIN DE CONFIGURACIÓN WEBSOCKETS 👆 */

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

await connectDB();

app.use(attachUser);

/* -------- rutas -------- */
app.use('/api/auth', authRoutes);
app.use('/api', pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/alegra', alegraRoutes); 
app.use('/api/guias', guiasRoutes);   
app.use('/api/tienda', tiendaRoutes); 
app.use('/api/correos', correosRoutes); // 👈 2. MONTAR LA RUTA DE CORREOS CR

app.get('/', (_req, res) => res.send('Chema Sport ER API con WebSockets'));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Servidor en tiempo real corriendo en puerto ${PORT}`));