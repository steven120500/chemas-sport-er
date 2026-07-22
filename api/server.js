import express from 'express';
import http from 'http'; // 👈 1. Importamos http nativo de Node
import { Server } from 'socket.io'; // 👈 2. Importamos el Server de Socket.io
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import connectDB from './config/db.js';

import attachUser from './middleware/attachUser.js';   // ⭐ IMPORTANTE
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import historyRoutes from './routes/historyroutes.js';

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

// ⭐ 1. CORS DE EXPRESS BLINDADO PARA TUS CABECERAS PERSONALIZADAS ⭐
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-admin', 'x-super', 'x-roles']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* 👇👇👇 CONFIGURACIÓN DE WEBSOCKETS OPTIMIZADA PARA RENDER 👇👇👇 */

// 3. Creamos el servidor HTTP envolviendo a la app de Express
const server = http.createServer(app);

// ⭐ 4. INICIALIZACIÓN BLINDADA CONTRA EL ERROR 502 DE RENDER ⭐
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user', 'x-admin', 'x-super', 'x-roles']
  },
  transports: ['websocket', 'polling'], // 👈 Obligatorio para que Render no tire 502
  pingTimeout: 60000,                   // 👈 60 segundos de paciencia para evitar desconexiones
  pingInterval: 25000                   // 👈 Mantiene viva la conexión en la nube
});

// 5. Guardamos 'io' en app para poder usarlo desde nuestros archivos de rutas (productRoutes)
app.set('io', io);

// 6. Escuchamos cuando alguien entra a la página
io.on('connection', (socket) => {
  console.log('🟢 Nuevo administrador conectado en vivo:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔴 Administrador desconectado:', socket.id);
  });
});
/* 👆👆👆 FIN DE CONFIGURACIÓN WEBSOCKETS 👆👆👆 */


app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', t: Date.now() });
});

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'API ok' });
});

await connectDB();

/* ⭐⭐⭐ SE AGREGA AQUÍ ⭐⭐⭐ */
app.use(attachUser);

/* -------- rutas -------- */
app.use('/api/auth', authRoutes);
app.use('/api', pdfRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productRoutes);

app.get('/', (_req, res) => res.send('Chema Sport ER API con WebSockets'));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;

// 7. Servidor escuchando
server.listen(PORT, () => console.log(`🚀 Servidor en tiempo real corriendo en puerto ${PORT}`));