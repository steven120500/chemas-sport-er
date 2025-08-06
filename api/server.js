import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();

// Habilitar CORS
app.use(cors({
  origin: '*', // Cambia esto a tu frontend si querés más seguridad
}));

// Parseo de JSON
app.use(express.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a MongoDB
connectDB();

// Rutas principales
app.use('/api/auth', authRoutes);         // Login / Registro con email y password
app.use('/api/products', productRoutes);  // Productos

// Ruta raíz
app.get('/', (req, res) => {
  res.send('Chemas Sport ER API');
});

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ message: 'API funcionando con Mongo Atlas' });
});

// Manejo de errores 404
app.use((req, res, next) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});