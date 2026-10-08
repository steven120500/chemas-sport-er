import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

// 🔥 ID DE TU NUMERACIÓN INTERNA (NO ELECTRÓNICA)
const ID_NUMERACION_INTERNA = 1; 

// 🔥 ID DEL NUEVO ÍTEM VÁLIDO CON CÓDIGO CABYS EN ALEGRA (Camiseta deportiva)
const ID_ITEM_CABYS = 8;

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas, tipo, precioManual } = req.body; 

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No se seleccionaron ventas para facturar." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    
    const itemsAlegra = [];
    let totalFactura = 0;

    // 1. Calculamos cuántas prendas hay en TOTAL
    let totalUnidadesGlobal = 0;
    ventas.forEach(v => {
      totalUnidadesGlobal += (Number(v.totalUnidades) || 1);
    });

    // 2. Sacamos el precio real de CADA prenda
    const precioManualNum = Number(precioManual);
    let precioUnitario = (precioManualNum && totalUnidadesGlobal > 0) 
      ? (precioManualNum / totalUnidadesGlobal) 
      : 10000;
      
    // 🔥 SOLUCIÓN: Cortamos los decimales a 5 máximo para que Alegra no lo rechace
    precioUnitario = Number(precioUnitario.toFixed(5));
    
    // 3. Armamos las líneas del tiquete usando el ID con CABYS (8)
    ventas.forEach((venta) => {
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      const subtotalVenta = precioUnitario * cantidadUnidades;
      totalFactura += subtotalVenta;

      if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          itemsAlegra.push({
            id: ID_ITEM_CABYS, 
            name: `${venta.item} - Talla: ${item.talla} (${item.tienda})`,
            price: precioUnitario,
            quantity: 1
          });
        });
      } else {
        itemsAlegra.push({
          id: ID_ITEM_CABYS, 
          name: venta.item || "Camiseta Deportiva",
          price: precioUnitario,
          quantity: cantidadUnidades
        });
      }
    });

    // 🔥 Redondeamos el pago total a 2 decimales exactos
    totalFactura = Number(totalFactura.toFixed(2));

    const fechaActual = new Date().toISOString().split('T')[0];
    
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: {
        id: 2 // Cliente de contado
      },
      items: itemsAlegra,
      paymentCondition: "01", // Contado
      paymentForm: "01",      // Efectivo
      status: "open",         // Emitida de una vez
      payments: [
        {
          account: { id: 1 }, // ID de la Caja General para que quede Pagada
          amount: totalFactura,
          date: fechaActual
        }
      ]
    };

    // 🔥 ENRUTAMIENTO: HACIENDA VS INTERNO
    if (tipo === "hacienda") {
      payloadAlegra.documentType = "04"; // 04 = Tiquete Electrónico oficial
    } else {
      // Interno = Plantilla NO electrónica
      payloadAlegra.numberTemplate = { id: ID_NUMERACION_INTERNA };
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

    const consecutivo = alegraData.numberTemplate ? alegraData.numberTemplate.fullNumber : alegraData.id;

    return res.status(200).json({
      success: true,
      message: "¡Generado con éxito!",
      consecutivoOficial: consecutivo,
      totalCobrado: totalFactura,
      alegraId: alegraData.id
    });

  } catch (error) {
    console.error("Error fatal en /emitir-tiquete:", error);
    res.status(500).json({ error: "Error en el servidor al conectar con Alegra." });
  }
});

export default router;