import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Conexión a MongoDB Atlas
connectDB();

// Rutas
app.use('/api/products', productRoutes);

// Endpoint de prueba
app.get('/api/ping', (req, res) => {
  res.json({ message: 'API funcionando con Mongo Atlas' });
});

// Servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
