import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    // Recibe las ventas y el tipo de emisión ("hacienda" o "interno")
    const { ventas, tipo } = req.body; 

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No se seleccionaron ventas para facturar." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    
    // Construir los ítems para la API de Alegra
    const itemsAlegra = [];
    
    ventas.forEach((venta) => {
      if (venta.items && Array.isArray(venta.items)) {
        venta.items.forEach((item) => {
          itemsAlegra.push({
            id: 1, // ID del ítem "Venta simple" en Alegra
            name: `${venta.item} - Talla: ${item.talla} (${item.tienda})`,
            price: Number(venta.price) || 10000,
            quantity: 1
          });
        });
      } else {
        itemsAlegra.push({
          id: 1, // ID del ítem "Venta simple" en Alegra
          name: venta.item || "Camiseta Deportiva",
          price: Number(venta.price) || 10000,
          quantity: venta.totalUnidades || 1
        });
      }
    });

    const fechaActual = new Date().toISOString().split('T')[0];
    
    // Estructura base del comprobante con códigos oficiales de CR
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: {
        id: 2 // ID exacto del cliente de contado en tu cuenta de Alegra
      },
      items: itemsAlegra,
      paymentForm: "01",       // 01 = Efectivo (Requisito Hacienda CR)
      paymentMethod: "contado" // Método de pago (Requisito Hacienda CR)
    };

    // 🔥 Si es hacienda, forzamos el Tiquete Electrónico (04)
    if (tipo === "hacienda") {
      payloadAlegra.documentType = "04"; 
    } 
    // Si es "interno", Alegra creará una factura básica/ticket interno según tu configuración

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

    return res.status(200).json({
      success: true,
      message: tipo === "hacienda" 
        ? "¡Tiquete electrónico oficial generado ante Hacienda!"
        : "Ticket interno generado con éxito.",
      pdfUrl: alegraData.printUrl || alegraData.pdf || null,
      alegraId: alegraData.id
    });

  } catch (error) {
    console.error("Error fatal en /emitir-tiquete:", error);
    res.status(500).json({ error: "Error en el servidor al conectar con Alegra." });
  }
});

export default router;