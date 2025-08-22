import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import historyroutes from "./routes/historyroutes";
import pdfRoutes from "./routes/pdfRoutes.js";


dotenv.config();

const app = express();

// ---------- CONFIGURACIÓN CORS ----------
const allowedOrigins = [
  "https://chemas-sport-er.onrender.com", // frontend en Render
  "http://localhost:5173"                 // desarrollo local con Vite
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // permite Postman/cURL
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = "CORS bloqueado para este dominio: " + origin;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// ---------- MIDDLEWARE ----------
app.use(express.json());

// ---------- RUTAS ----------
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/history", historyroutes);
app.use("/api/pdfRoutes", pdfRoutes);

// Ruta de prueba para verificar que el server responde
app.get("/", (req, res) => {
  res.send("ok");
});

// ---------- CONEXIÓN A MONGO ----------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB conectado"))
.catch((err) => console.error("❌ Error al conectar MongoDB:", err));

// ---------- SERVIDOR ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});







