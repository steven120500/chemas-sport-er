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

// ==========================================
// ⚡ SISTEMA DE CACHÉ EN MEMORIA (ACELERADOR)
// ==========================================
let cachedToken = null;
let tokenExpirationTime = 0;

// Guardamos provincias, cantones, distritos y sucursales en memoria RAM
const catalogosCache = {
  provincias: null,
  cantones: new Map(),   // llave: idProvincia
  distritos: new Map(),  // llave: `${idProvincia}-${idCanton}`
  sucursales: new Map()  // llave: `${idProvincia}-${idCanton}`
};

// Función auxiliar para limpiar la URL base y evitar dobles barras
function getBaseUrl() {
  if (!CCR_API_URL) return '';
  return CCR_API_URL.endsWith('/') ? CCR_API_URL.slice(0, -1) : CCR_API_URL;
}

// ==========================================
// 1. FUNCIÓN AUXILIAR: OBTENER TOKEN (CON CACHÉ)
// ==========================================
async function obtenerTokenCCR(forzarNuevo = false) {
  const ahora = Date.now();

  // Si ya tenemos un token válido en memoria, lo devolvemos en 0ms sin ir a Correos CR
  if (!forzarNuevo && cachedToken && ahora < tokenExpirationTime) {
    return cachedToken;
  }

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

    let token = null;
    if (response.data && response.data.accessToken) {
      token = response.data.accessToken;
    } else if (response.data && response.data.datos && response.data.datos.accessToken) {
      token = response.data.datos.accessToken;
    }

    if (token) {
      cachedToken = token;
      // Guardamos el token por 12 minutos (720,000 ms)
      tokenExpirationTime = ahora + 12 * 60 * 1000;
      return cachedToken;
    }

    throw new Error('La API respondió pero no se encontró el accessToken.');
  } catch (error) {
    cachedToken = null;
    tokenExpirationTime = 0;
    console.error("\n[CCR-AUTH ERROR] -> Falló la autenticación en Producción");
    console.error("[CCR-AUTH ERROR] -> Status Code:", error.response?.status);
    console.error("[CCR-AUTH ERROR] -> Response Data:", JSON.stringify(error.response?.data, null, 2));
    throw new Error('Falló la autenticación con Correos CR (Producción)');
  }
}

// Función auxiliar que reintenta automáticamente si el token de Correos expiró antes de tiempo
async function peticionConTokenCCR(configFn) {
  try {
    const token = await obtenerTokenCCR(false);
    return await configFn(token);
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log("[CCR-AUTH] -> Token expirado, renovando automáticamente...");
      const nuevoToken = await obtenerTokenCCR(true);
      return await configFn(nuevoToken);
    }
    throw error;
  }
}

// ==========================================
// 2. ENDPOINT DE PRUEBA DE CONEXIÓN
// ==========================================
router.get('/test-auth', async (req, res) => {
  try {
    await obtenerTokenCCR();
    res.json({ exito: true, mensaje: "Conexión a Producción de Correos CR exitosa", tokenGenerado: true });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: error.message });
  }
});

// ==========================================
// 3. CATÁLOGOS GEOGRÁFICOS Y SUCURSALES (CON CACHÉ)
// ==========================================

router.get('/provincias', async (req, res) => {
  try {
    // Si ya están en memoria, responde instantáneamente (0ms)
    if (catalogosCache.provincias) {
      return res.json(catalogosCache.provincias);
    }

    const baseUrl = getBaseUrl();
    const response = await peticionConTokenCCR((token) => 
      axios.get(`${baseUrl}/ubicaciones/provincias`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    if (response.data) {
      catalogosCache.provincias = response.data;
    }
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo provincias:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener provincias", detalle: error?.response?.data || error.message });
  }
});

router.get('/cantones/:idProvincia', async (req, res) => {
  try {
    const { idProvincia } = req.params;

    if (catalogosCache.cantones.has(idProvincia)) {
      return res.json(catalogosCache.cantones.get(idProvincia));
    }

    const baseUrl = getBaseUrl();
    const response = await peticionConTokenCCR((token) => 
      axios.get(`${baseUrl}/ubicaciones/cantones?provincia=${idProvincia}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    if (response.data) {
      catalogosCache.cantones.set(idProvincia, response.data);
    }
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo cantones:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener cantones" });
  }
});

router.get('/distritos/:idProvincia/:idCanton', async (req, res) => {
  try {
    const { idProvincia, idCanton } = req.params;
    const cacheKey = `${idProvincia}-${idCanton}`;

    if (catalogosCache.distritos.has(cacheKey)) {
      return res.json(catalogosCache.distritos.get(cacheKey));
    }

    const baseUrl = getBaseUrl();
    const response = await peticionConTokenCCR((token) => 
      axios.get(`${baseUrl}/ubicaciones/distritos?provincia=${idProvincia}&canton=${idCanton}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    if (response.data) {
      catalogosCache.distritos.set(cacheKey, response.data);
    }
    res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo distritos:", error?.response?.data || error.message);
    res.status(500).json({ exito: false, mensaje: "Error al obtener distritos" });
  }
});

router.get('/sucursales/:idProvincia/:idCanton', async (req, res) => {
  try {
    const { idProvincia, idCanton } = req.params;
    const cacheKey = `${idProvincia}-${idCanton}`;

    if (catalogosCache.sucursales.has(cacheKey)) {
      return res.json(catalogosCache.sucursales.get(cacheKey));
    }

    console.log(`[CCR-SUCURSALES] -> Consultando sucursales para Provincia: ${idProvincia}, Cantón: ${idCanton}`);
    
    const baseUrl = getBaseUrl();
    const response = await peticionConTokenCCR((token) => 
      axios.get(`${baseUrl}/ubicaciones/sucursales?provincia=${idProvincia}&canton=${idCanton}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );
    
    if (response.data) {
      catalogosCache.sucursales.set(cacheKey, response.data);
    }
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
      
      // Datos oficiales del remitente corporativo Chema Sport ER
      sendNombre: "CHEMASPORT ER SOCIEDAD DE RESPONSABILIDAD LIMITADA",
      sendDireccion: "Alajuela, Grecia, Puente de Piedra, Condominio Lomas del Bosque", 
      sendTelefono: "71103209",  
      sendZip: "20307",          
      
      observaciones: observaciones || "Paquete",
      usuarioId: CCR_CODIGO_CLIENTE.toString(), 
      peso: parseInt(peso, 10) || 500, 
      tipoDestino: tipoDestino,
      codigoSucursal: codigoSucursal
    };

    console.log("[CCR-GUIA] -> Registrando guía en Producción:", JSON.stringify(payloadCorreos, null, 2));

    const response = await peticionConTokenCCR((token) => 
      axios.post(`${baseUrl}/guiasweb/registrar`, payloadCorreos, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

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