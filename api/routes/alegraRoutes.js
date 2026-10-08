import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

// ID DE LA NUMERACIÓN INTERNA (NO ELECTRÓNICA)
const ID_NUMERACION_INTERNA = 1; 

// ID DEL NUEVO ÍTEM VÁLIDO CON CÓDIGO CABYS EN ALEGRA (Camiseta deportiva)
const ID_ITEM_CABYS = 8;

/* ========================================================
   🔍 CONSULTAR CÉDULA EN HACIENDA
   ======================================================== */
router.get('/consultar-cedula/:identificacion', async (req, res) => {
  try {
    const { identificacion } = req.params;
    const response = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${identificacion}`);
    
    if (!response.ok) {
      return res.status(404).json({ error: "No se encontró información para esta cédula en el registro." });
    }
    
    const data = await response.json();
    return res.status(200).json({
      success: true,
      nombre: data.nombre || "Cliente Electrónico"
    });
  } catch (error) {
    console.error("Error al consultar cédula:", error);
    res.status(500).json({ error: "Error al conectar con el servicio de consulta." });
  }
});

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    // 🔥 AQUÍ SE RECIBE EL NUEVO TIPO DE IDENTIFICACIÓN DESDE EL FRONTEND
    const { ventas, tipo, precioManual, cedula, nombreCliente, email, tipoIdentificacion } = req.body; 

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No se seleccionaron ventas para facturar." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    
    // CLIENTE DINÁMICO: Si el usuario digitó una cédula, la usamos obligatoriamente
    let clientId = 2; // Por defecto solo si no hay cédula

    if (cedula && cedula.trim() !== "") {
      const cedulaLimpiada = cedula.trim();
      const contactRes = await fetch(`https://api.alegra.com/api/v1/contacts?identification=${cedulaLimpiada}`, {
        headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
      });
      const contactsData = await contactRes.json();

      if (Array.isArray(contactsData) && contactsData.length > 0) {
        clientId = contactsData[0].id;
        if (email) {
          await fetch(`https://api.alegra.com/api/v1/contacts/${clientId}`, {
            method: "PUT",
            headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ email: email.trim() })
          });
        }
      } else {
        const newContactRes = await fetch(`https://api.alegra.com/api/v1/contacts`, {
          method: "POST",
          headers: { 
            "Authorization": `Basic ${credentials}`, 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            name: nombreCliente || "Cliente Electrónico",
            // 🔥 AQUÍ SE ARREGLA EL ERROR 2035 ENVIANDO EL TIPO EXACTO
            identificationObject: {
              type: tipoIdentificacion || "01",
              number: cedulaLimpiada
            },
            email: email ? email.trim() : "",
            type: "client"
          })
        });
        const newContactData = await newContactRes.json();
        
        if (newContactRes.ok && newContactData.id) {
          clientId = newContactData.id;
          console.log("✅ CONTACTO CREADO EXITOSAMENTE EN ALEGRA. ID:", clientId);
        } else {
          console.error("❌ ERROR DE ALEGRA AL CREAR EL CONTACTO:", newContactData);
        }
      }
    }

    const itemsAlegra = [];
    let totalFactura = 0;

    let totalUnidadesGlobal = 0;
    ventas.forEach(v => {
      totalUnidadesGlobal += (Number(v.totalUnidades) || 1);
    });

    const precioManualNum = Number(precioManual);
    let precioUnitario = (precioManualNum && totalUnidadesGlobal > 0) 
      ? (precioManualNum / totalUnidadesGlobal) 
      : 10000;
      
    precioUnitario = Number(precioUnitario.toFixed(5));
    
    ventas.forEach((venta) => {
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      const subtotalVenta = precioUnitario * cantidadUnidades;
      totalFactura += subtotalVenta;

      if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          itemsAlegra.push({
            id: ID_ITEM_CABYS, 
            name: `${venta.item} - Talla: ${item.talla} (${item.tienda})`, // 🔥 SINTAXIS ARREGLADA
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

    totalFactura = Number(totalFactura.toFixed(2));
    const fechaActual = new Date().toISOString().split('T')[0];
    
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: {
        id: clientId 
      },
      items: itemsAlegra,
      paymentCondition: "01",
      paymentForm: "01",
      status: "open",
      payments: [
        {
          account: { id: 1 },
          amount: totalFactura,
          date: fechaActual
        }
      ]
    };

    if (tipo === "hacienda") {
      payloadAlegra.documentType = "04"; // Tiquete electrónico oficial
    } else {
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
      console.error("Error de Alegra al emitir factura:", alegraData);
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