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
// 1. FUNCIÓN AUXILIAR: OBTENER TOKEN (CON RAYOS X)
// ==========================================
async function obtenerTokenCCR() {
  try {
    const payloadLogin = {
      usuario: CCR_USUARIO,
      password: CCR_PASSWORD
    };
    
    console.log("\n[CCR-AUTH] -> Iniciando petición de Token...");
    console.log("[CCR-AUTH] -> URL:", `${CCR_API_URL}/auth/login`);
    console.log("[CCR-AUTH] -> Payload:", payloadLogin);

    const response = await axios.post(`${CCR_API_URL}/auth/login`, payloadLogin, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log("[CCR-AUTH] -> Respuesta de Correos:", response.data);

    if (response.data && response.data.accessToken) {
      return response.data.accessToken;
    }
    
    throw new Error('La API respondió sin error HTTP, pero no devolvió el accessToken.');
  } catch (error) {
    console.error("\n[CCR-AUTH ERROR] -> Falló la autenticación");
    console.error("[CCR-AUTH ERROR] -> Status Code:", error.response?.status);
    console.error("[CCR-AUTH ERROR] -> Response Data:", JSON.stringify(error.response?.data, null, 2));
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
    console.log("\n[CCR-GEO] -> Solicitando Provincias...");
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${CCR_API_URL}/ubicaciones/provincias`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("\n[CCR-GEO ERROR] -> Falló Provincias");
    console.error("[CCR-GEO ERROR] -> Status:", error.response?.status);
    console.error("[CCR-GEO ERROR] -> Data:", JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({ exito: false, mensaje: "Error al obtener provincias" });
  }
});

// Obtener Cantones por Provincia
router.get('/cantones/:idProvincia', async (req, res) => {
  try {
    const { idProvincia } = req.params;
    console.log(`\n[CCR-GEO] -> Solicitando Cantones para Provincia ID: ${idProvincia}...`);
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${CCR_API_URL}/ubicaciones/cantones?provincia=${idProvincia}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("\n[CCR-GEO ERROR] -> Falló Cantones");
    console.error("[CCR-GEO ERROR] -> Status:", error.response?.status);
    console.error("[CCR-GEO ERROR] -> Data:", JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({ exito: false, mensaje: "Error al obtener cantones" });
  }
});

// Obtener Distritos por Provincia y Cantón
router.get('/distritos/:idProvincia/:idCanton', async (req, res) => {
  try {
    const { idProvincia, idCanton } = req.params;
    console.log(`\n[CCR-GEO] -> Solicitando Distritos (Prov: ${idProvincia}, Canton: ${idCanton})...`);
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${CCR_API_URL}/ubicaciones/distritos?provincia=${idProvincia}&canton=${idCanton}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("\n[CCR-GEO ERROR] -> Falló Distritos");
    console.error("[CCR-GEO ERROR] -> Status:", error.response?.status);
    console.error("[CCR-GEO ERROR] -> Data:", JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({ exito: false, mensaje: "Error al obtener distritos" });
  }
});

// ==========================================
// 4. GENERAR GUÍA DE ENVÍO
// ==========================================
router.post('/generar-guia', async (req, res) => {
  try {
    console.log("\n[CCR-GUIA] -> Iniciando registro de guía...");
    const { 
      destNombre, destDireccion, destTelefono, destZip, 
      peso, observaciones, montoFlete = 1800, tipoDestino
    } = req.body;

    const token = await obtenerTokenCCR();
    const fechaActual = new Date().toISOString();

    const payloadCorreos = {
      codigoCliente: parseInt(CCR_CODIGO_CLIENTE, 10),
      fechaImposicion: fechaActual,
      envioId: "", 
      servicioId: parseInt(CCR_CODIGO_SERVICIO, 10),
      montoFlete: montoFlete,
      destNombre: destNombre,
      destDireccion: destDireccion,
      destTelefono: destTelefono,
      destZip: destZip,
      sendNombre: "Chema Sport ER",
      sendDireccion: "San José", 
      sendTelefono: "88888888",  
      sendZip: "10101",          
      observaciones: observaciones || "Paquete",
      usuarioId: CCR_CODIGO_CLIENTE, 
      peso: parseInt(peso, 10) || 500, 
      tipoDestino: tipoDestino || "DOM",
      codigoSucursal: ""
    };

    console.log("[CCR-GUIA] -> Payload preparado para Correos:", JSON.stringify(payloadCorreos, null, 2));

    const response = await axios.post(`${CCR_API_URL}/guiasweb/registrar`, payloadCorreos, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("[CCR-GUIA] -> Respuesta Exitosa de Correos:", response.data);

    if (response.data && response.data.exito) {
      res.json(response.data);
    } else {
      res.status(400).json(response.data);
    }

  } catch (error) {
    console.error("\n[CCR-GUIA ERROR] -> Error al generar la guía");
    console.error("[CCR-GUIA ERROR] -> Status:", error.response?.status);
    console.error("[CCR-GUIA ERROR] -> Data:", JSON.stringify(error.response?.data, null, 2));
    
    res.status(500).json({ 
      exito: false, 
      mensaje: "Error de conexión al generar guía en Correos CR",
      detalle: error?.response?.data || error.message 
    });
  }
});

export default router;