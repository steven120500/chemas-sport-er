import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas, tipo } = req.body; 

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No se seleccionaron ventas para facturar." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    
    const itemsAlegra = [];
    let totalFactura = 0;
    
    ventas.forEach((venta) => {
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      const precioPorPrenda = Number(venta.price) || Number(venta.precio) || 10000;
      
      const subtotalVenta = precioPorPrenda * cantidadUnidades;
      totalFactura += subtotalVenta;

      if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          itemsAlegra.push({
            id: 1, 
            name: `${venta.item} - Talla: ${item.talla} (${item.tienda})`,
            price: precioPorPrenda,
            quantity: 1
          });
        });
      } else {
        itemsAlegra.push({
          id: 1, 
          name: venta.item || "Camiseta Deportiva",
          price: precioPorPrenda,
          quantity: cantidadUnidades
        });
      }
    });

    const fechaActual = new Date().toISOString().split('T')[0];
    
    // Estructura corregida con los códigos oficiales en el bloque de pagos
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: {
        id: 2 
      },
      items: itemsAlegra,
      paymentCondition: "01", // Contado
      paymentForm: "01",       // Efectivo
      status: "open",          // Emitida directamente
      payments: [
        {
          paymentMethod: "01", // 🔥 Corregido: Usamos "01" en lugar de "cash" para la API de CR
          amount: totalFactura,
          date: fechaActual
        }
      ]
    };

    if (tipo === "hacienda") {
      payloadAlegra.documentType = "04"; 
    } 

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