import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import connectDB from './config/db.js';


import attachUser from './middlewares/attachUser.js';   // ⭐ IMPORTANTE
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


app.use(cors({
  origin: [
    'https://chemasport-er.onrender.com',
    'http://localhost:5173'
  ],
}));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


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


app.get('/', (_req, res) => res.send('Chema Sport ER API'));


app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
