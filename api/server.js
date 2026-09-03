import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import connectDB from './config/db.js';

import attachUser from './middleware/attachUser.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js';
import saleRoutes from './routes/saleRoutes.js'; // 👈 1. IMPORTAR RUTA DE VENTAS

dotenv.config();

const app = express();

app.disable('x-powered-by');
app.set('json spaces', 0);
app.set('trust proxy', 1);

app.use(compression());

// Guardamos los dominios permitidos
const allowedOrigins = [
  'https://chemasport-er.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  "https://chemasporter.com",           
  "https://www.chemasporter.com"
];

// ⭐ CORS DE EXPRESS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-admin', 'x-super', 'x-roles']
}));

// 🚀 LÍMITE AMPLIADO PARA FOTOS EN BASE64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/* 👇 CONFIGURACIÓN DE WEBSOCKETS 👇 */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-admin', 'x-super', 'x-roles']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('🟢 Nuevo administrador conectado en vivo:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔴 Administrador desconectado:', socket.id);
  });
});
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
app.use('/api/sales', saleRoutes); // 👈 2. MONTAR LA RUTA DE VENTAS Y ANULACIÓN

app.get('/', (_req, res) => res.send('Chema Sport ER API con WebSockets'));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Servidor en tiempo real corriendo en puerto ${PORT}`));