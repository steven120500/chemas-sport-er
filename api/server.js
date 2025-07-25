import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

connectDB(); // ← importante

app.get('/api/ping', (req, res) => res.json({ message: 'API funcionando con Mongo Atlas' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
