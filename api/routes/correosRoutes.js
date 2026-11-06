import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Variables de entorno de Correos CR (Producción)
const CCR_API_URL = process.env.CCR_API_URL;
const CCR_USUARIO = process.env.CCR_USUARIO;
const CCR_PASSWORD = process.env.CCR_PASSWORD;
const CCR_CODIGO_CLIENTE = process.env.CCR_CODIGO_CLIENTE;
const CCR_CODIGO_SERVICIO = process.env.CCR_CODIGO_SERVICIO;

// Función auxiliar para limpiar la URL base y evitar dobles barras
function getBaseUrl() {
  if (!CCR_API_URL) return '';
  return CCR_API_URL.endsWith('/') ? CCR_API_URL.slice(0, -1) : CCR_API_URL;
}

// ==========================================
// 1. FUNCIÓN AUXILIAR: OBTENER TOKEN
// ==========================================
async function obtenerTokenCCR() {
  try {
    const baseUrl = getBaseUrl();
    const payloadLogin = {
      usuario: CCR_USUARIO,
      password: CCR_PASSWORD
    };
    
    console.log("\n[CCR-AUTH] -> Solicitando Token a Producción...");
    console.log("[CCR-AUTH] -> URL:", `${baseUrl}/auth/login`);

    const response = await axios.post(`${baseUrl}/auth/login`, payloadLogin, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log("[CCR-AUTH] -> Respuesta de Correos:", response.data);

    if (response.data && response.data.accessToken) {
      return response.data.accessToken;
    }
    
    if (response.data && response.data.datos && response.data.datos.accessToken) {
      return response.data.datos.accessToken;
    }

    throw new Error('La API respondió pero no se encontró el accessToken.');
  } catch (error) {
    console.error("\n[CCR-AUTH ERROR] -> Falló la autenticación en Producción");
    console.error("[CCR-AUTH ERROR] -> Status Code:", error.response?.status);
    console.error("[CCR-AUTH ERROR] -> Response Data:", JSON.stringify(error.response?.data, null, 2));
    throw new Error('Falló la autenticación con Correos CR (Producción)');
  }
}

// ==========================================
// 2. ENDPOINT DE PRUEBA DE CONEXIÓN
// ==========================================
router.get('/test-auth', async (req, res) => {
  try {
    const token = await obtenerTokenCCR();
    res.json({ exito: true, mensaje: "Conexión a Producción de Correos CR exitosa", tokenGenerado: true });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: error.message });
  }
});

// ==========================================
// 3. CATÁLOGOS GEOGRÁFICOS Y SUCURSALES
// ==========================================

router.get('/provincias', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${baseUrl}/ubicaciones/provincias`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo provincias:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener provincias", detalle: error?.response?.data || error.message });
  }
});

router.get('/cantones/:idProvincia', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    const { idProvincia } = req.params;
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${baseUrl}/ubicaciones/cantones?provincia=${idProvincia}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo cantones:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener cantones" });
  }
});

router.get('/distritos/:idProvincia/:idCanton', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    const { idProvincia, idCanton } = req.params;
    const token = await obtenerTokenCCR();
    const response = await axios.get(`${baseUrl}/ubicaciones/distritos?provincia=${idProvincia}&canton=${idCanton}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo distritos:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener distritos" });
  }
});

// NUEVO: Endpoint para consultar sucursales por Provincia y Cantón (Manual pág. 27)[cite: 37]
router.get('/sucursales/:idProvincia/:idCanton', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    const { idProvincia, idCanton } = req.params;
    const token = await obtenerTokenCCR();
    
    console.log(`[CCR-SUCURSALES] -> Consultando sucursales para Provincia: ${idProvincia}, Cantón: ${idCanton}`);
    
    const response = await axios.get(`${baseUrl}/ubicaciones/sucursales?provincia=${idProvincia}&canton=${idCanton}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo sucursales:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener sucursales", detalle: error?.response?.data || error.message });
  }
});

// ==========================================
// 4. GENERAR GUÍA DE ENVÍO
// ==========================================
router.post('/generar-guia', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    const { 
      destNombre, destDireccion, destTelefono, destZip, 
      peso, observaciones, montoFlete = 1800, tipoDestino = "DOM", codigoSucursal = "" 
    } = req.body;

    const token = await obtenerTokenCCR();
    const fechaActual = new Date().toISOString();

    const payloadCorreos = {
      codigoCliente: parseInt(CCR_CODIGO_CLIENTE, 10),
      fechaImposicion: fechaActual,
      envioId: "", 
      servicioId: parseInt(CCR_CODIGO_SERVICIO, 10),
      montoFlete: parseFloat(montoFlete),
      destNombre: destNombre,
      destDireccion: destDireccion || "",
      destTelefono: destTelefono,
      destZip: destZip || "",
      
      sendNombre: "Chema Sport ER",
      sendDireccion: "San José", 
      sendTelefono: "88888888",  
      sendZip: "10101",          
      
      observaciones: observaciones || "Paquete",
      usuarioId: CCR_CODIGO_CLIENTE.toString(), 
      peso: parseInt(peso, 10) || 500, 
      tipoDestino: tipoDestino,
      codigoSucursal: codigoSucursal
    };

    console.log("[CCR-GUIA] -> Registrando guía en Producción:", JSON.stringify(payloadCorreos, null, 2));

    const response = await axios.post(`${baseUrl}/guiasweb/registrar`, payloadCorreos, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.data && response.data.exito) {
      res.json(response.data);
    } else {
      res.status(400).json(response.data);
    }

  } catch (error) {
    console.error("Error generando guía:", error?.response?.data || error.message);
    res.status(500).json({ 
      exito: false, 
      mensaje: "Error al generar guía en Correos CR",
      detalle: error?.response?.data || error.message 
    });
  }
});

export default router;