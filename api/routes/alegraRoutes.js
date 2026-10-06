import express from 'express';
import fetch from 'node-fetch'; // O usa el fetch nativo de Node si estás en versiones recientes

const router = express.Router();

// Credenciales proporcionadas
const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "Chemas@123";

/* ========================================================
   🧾 EMITIR TIQUETE ELECTRÓNICO EN ALEGRA
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas } = req.body; // Recibe el arreglo de ventas seleccionadas desde el frontend

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No se seleccionaron ventas para facturar." });
    }

    // 1. Preparar la autenticación Basic Auth para Alegra
    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');

    // 2. Construir los ítems para la API de Alegra basados en las ventas del usuario
    const itemsAlegra = [];
    
    ventas.forEach((venta) => {
      // Si la venta tiene múltiples tallas o ítems detallados
      if (venta.items && Array.isArray(venta.items)) {
        venta.items.forEach((item) => {
          itemsAlegra.push({
            name: `${venta.item} - Talla: ${item.talla} (${item.tienda})`,
            price: Number(venta.price) || 10000, // Ajusta según el precio real de tu producto si lo tienes guardado
            quantity: 1
          });
        });
      } else {
        itemsAlegra.push({
          name: venta.item || "Camiseta Deportiva",
          price: Number(venta.price) || 10000,
          quantity: venta.totalUnidades || 1
        });
      }
    });

    // 3. Estructura de la factura/tiquete para la API de Alegra (Costa Rica)
    const fechaActual = new Date().toISOString().split('T')[0];
    
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: {
        name: ventas[0]?.cliente || "Cliente General",
        identification: "000000000" // Identificación genérica por defecto para tiquetes
      },
      // En Costa Rica, el documento 04 corresponde a Tiquete Electrónico
      documentType: "04", 
      items: itemsAlegra,
      payments: [
        {
          paymentMethod: "cash",
          amount: itemsAlegra.reduce((sum, i) => sum + (i.price * i.quantity), 0),
          date: fechaActual
        }
      ]
    };

    // 4. Enviar la petición a la API oficial de Alegra
    const alegraResponse = await fetch("https://api.alegra.com/api/v1/invoices", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payloadAlegra)
    });

    const alegraData = await alegraResponse.json();

    if (!alegraResponse.ok) {
      console.error("Error de Alegra:", alegraData);
      return res.status(400).json({ 
        error: alegraData.message || "Error al generar el tiquete electrónico en Alegra." 
      });
    }

    // 5. Devolver el enlace del PDF o éxito al frontend
    return res.status(200).json({
      success: true,
      message: "¡Tiquete electrónico generado con éxito ante Hacienda!",
      pdfUrl: alegraData.printUrl || alegraData.pdf || null,
      alegraId: alegraData.id
    });

  } catch (error) {
    console.error("Error fatal en /emitir-tiquete:", error);
    res.status(500).json({ error: "Error en el servidor al conectar con Alegra." });
  }
});

export default router;