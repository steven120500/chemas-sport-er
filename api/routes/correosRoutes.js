import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Variables de entorno de Correos CR (Asegúrate de tenerlas en tu .env)
const CCR_API_URL = process.env.CCR_API_URL;
const CCR_USUARIO = process.env.CCR_USUARIO;
const CCR_PASSWORD = process.env.CCR_PASSWORD;
const CCR_CODIGO_CLIENTE = process.env.CCR_CODIGO_CLIENTE;
const CCR_CODIGO_SERVICIO = process.env.CCR_CODIGO_SERVICIO;

// Función auxiliar para obtener el Token
async function obtenerTokenCCR() {
  try {
    const response = await axios.post(`${CCR_API_URL}/auth/login`, {
      usuario: CCR_USUARIO,
      password: CCR_PASSWORD
    });
    
    if (response.data && response.data.accessToken) {
      return response.data.accessToken;
    }
    throw new Error('No se recibió el token de la API de Correos');
  } catch (error) {
    console.error("Error al autenticar en Correos CR:", error?.response?.data || error.message);
    throw new Error('Falló la autenticación con Correos CR');
  }
}

// 1. Endpoint de prueba para verificar conexión (Solo loguea y devuelve el estado)
router.get('/test-auth', async (req, res) => {
  try {
    const token = await obtenerTokenCCR();
    // No enviamos el token al frontend por seguridad, solo confirmamos que funciona
    res.json({ exito: true, mensaje: "Conexión a Correos CR exitosa", tokenGenerado: true });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: error.message });
  }
});

export default router;