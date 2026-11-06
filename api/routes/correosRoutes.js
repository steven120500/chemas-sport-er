import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Variables de entorno de Correos CR
const CCR_API_URL = process.env.CCR_API_URL;
const CCR_USUARIO = process.env.CCR_USUARIO;
const CCR_PASSWORD = process.env.CCR_PASSWORD;
const CCR_CODIGO_CLIENTE = process.env.CCR_CODIGO_CLIENTE;
const CCR_CODIGO_SERVICIO = process.env.CCR_CODIGO_SERVICIO;

// ==========================================
// 1. FUNCIÓN AUXILIAR: OBTENER TOKEN
// ==========================================
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

// ==========================================
// 2. ENDPOINT DE PRUEBA DE CONEXIÓN
// ==========================================
router.get('/test-auth', async (req, res) => {
  try {
    await obtenerTokenCCR();
    res.json({ exito: true, mensaje: "Conexión a Correos CR exitosa", tokenGenerado: true });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: error.message });
  }
});

// ==========================================
// 3. CATÁLOGOS GEOGRÁFICOS (PROVINCIAS, CANTONES, DISTRITOS)
// ==========================================

// Obtener Provincias
router.get('/provincias', async (req, res) => {
  try {
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${CCR_API_URL}/ubicaciones/provincias`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo provincias:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener provincias" });
  }
});

// Obtener Cantones por Provincia
router.get('/cantones/:idProvincia', async (req, res) => {
  try {
    const { idProvincia } = req.params;
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${CCR_API_URL}/ubicaciones/cantones?provincia=${idProvincia}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo cantones:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener cantones" });
  }
});

// Obtener Distritos por Provincia y Cantón
router.get('/distritos/:idProvincia/:idCanton', async (req, res) => {
  try {
    const { idProvincia, idCanton } = req.params;
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${CCR_API_URL}/ubicaciones/distritos?provincia=${idProvincia}&canton=${idCanton}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo distritos:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener distritos" });
  }
});

// ==========================================
// 4. GENERAR GUÍA DE ENVÍO
// ==========================================
router.post('/generar-guia', async (req, res) => {
  try {
    const { 
      destNombre, destDireccion, destTelefono, destZip, 
      peso, observaciones, montoFlete = 1800 // Flete por defecto o el que calcules
    } = req.body;

    const token = await obtenerTokenCCR();
    const fechaActual = new Date().toISOString(); // Correos pide fecha en formato ISO

    // Armamos el JSON estricto que exige Correos CR
    const payloadCorreos = {
      codigoCliente: parseInt(CCR_CODIGO_CLIENTE, 10),
      fechaImposicion: fechaActual,
      envioId: "", // Vacío para que Correos genere el consecutivo oficial
      servicioId: parseInt(CCR_CODIGO_SERVICIO, 10),
      montoFlete: montoFlete,
      destNombre: destNombre,
      destDireccion: destDireccion,
      destTelefono: destTelefono,
      destZip: destZip,
      
      // Datos del Remitente (Chema Sport ER)
      sendNombre: "Chema Sport ER",
      sendDireccion: "San José", // Puedes poner la dirección exacta de tu tienda
      sendTelefono: "88888888",  // Tu teléfono oficial
      sendZip: "10101",          // Tu código postal
      
      observaciones: observaciones || "Paquete delicado",
      usuarioId: CCR_CODIGO_CLIENTE, // Opcional, pero se suele mandar el mismo cod cliente
      peso: parseInt(peso, 10) || 500, // Peso en gramos
      tipoDestino: "DOM", // DOM = Domicilio (Si usas sucursal sería SUC y requiere codigoSucursal)
      codigoSucursal: ""
    };

    const response = await axios.post(`${CCR_API_URL}/guiasweb/registrar`, payloadCorreos, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.data && response.data.exito) {
      // Devuelve la respuesta exitosa al frontend, incluyendo el pdfBase64
      res.json(response.data);
    } else {
      res.status(400).json(response.data);
    }

  } catch (error) {
    console.error("Error generando guía:", error?.response?.data || error.message);
    res.status(500).json({ 
      exito: false, 
      mensaje: "Error de conexión al generar guía en Correos CR",
      detalle: error?.response?.data || error.message 
    });
  }
});

export default router;