import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA (VERSION DEFINITIVA)
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas, tipo } = req.body; 

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No se seleccionaron ventas para facturar." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    
    const itemsAlegra = [];
    
    ventas.forEach((venta) => {
      // 1. Calculamos el precio y las cantidades reales
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      const precioPorPrenda = Number(venta.price) || Number(venta.precio) || 10000;

      // 2. Construimos los ítems para Alegra
      if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          itemsAlegra.push({
            id: 1, // ID del ítem "Venta simple" en Alegra
            name: `${venta.item} - Talla: ${item.talla} (${item.tienda})`,
            price: precioPorPrenda,
            quantity: 1
          });
        });
      } else {
        itemsAlegra.push({
          id: 1, // ID del ítem "Venta simple" en Alegra
          name: venta.item || "Camiseta Deportiva",
          price: precioPorPrenda,
          quantity: cantidadUnidades
        });
      }
    });

    const fechaActual = new Date().toISOString().split('T')[0];
    
    // 3. Estructura maestra a prueba de errores para Costa Rica
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: {
        id: 2 // ID exacto del cliente de contado
      },
      items: itemsAlegra,
      paymentCondition: "01", // Código Hacienda: 01 = Contado
      paymentForm: "01",      // Código Hacienda: 01 = Efectivo
      status: "open"          // Evita que se guarde como borrador
    };

    // 4. Enrutamiento del documento (Hacienda vs Interno)
    if (tipo === "hacienda") {
      payloadAlegra.documentType = "04"; // 04 = Tiquete Electrónico Oficial
    } 
    // Si es "interno", Alegra usa su consecutivo estándar de factura

    // 5. Envío a la API
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
        error: alegraData.message || "Error al generar el documento en Alegra." 
      });
    }

    // 6. Enlace de impresión limpia y directa
    const pdfGenerado = `https://app.alegra.com/print/invoice?id=${alegraData.id}`;

    return res.status(200).json({
      success: true,
      message: tipo === "hacienda" 
        ? "¡Tiquete electrónico oficial generado ante Hacienda!"
        : "Ticket interno generado con éxito.",
      pdfUrl: pdfGenerado,
      alegraId: alegraData.id
    });

  } catch (error) {
    console.error("Error fatal en /emitir-tiquete:", error);
    res.status(500).json({ error: "Error en el servidor al conectar con Alegra." });
  }
});

export default router;