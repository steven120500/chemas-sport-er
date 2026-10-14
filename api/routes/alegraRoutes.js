import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

// ID DE LA NUMERACIÓN INTERNA (NO ELECTRÓNICA)
const ID_NUMERACION_INTERNA = 1; 
const ID_ITEM_CABYS = 8;

/* ========================================================
   🔍 CONSULTAR CÉDULA EN HACIENDA
   ======================================================== */
router.get('/consultar-cedula/:identificacion', async (req, res) => {
  try {
    const { identificacion } = req.params;
    const response = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${identificacion}`);
    if (!response.ok) return res.status(404).json({ error: "No se encontró información." });
    const data = await response.json();
    return res.status(200).json({ success: true, nombre: data.nombre || "Cliente Electrónico" });
  } catch (error) {
    res.status(500).json({ error: "Error de consulta." });
  }
});

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA (CON ESPÍAS)
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas, tipo, precioManual, cedula, nombreCliente, email, tipoIdentificacion } = req.body; 
    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) return res.status(400).json({ error: "Sin ventas." });

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    let clientId = 2; // Cliente por defecto

    if (cedula && cedula.trim() !== "") {
      const cedulaLimpiada = cedula.trim();

      // 🔥 TRADUCTOR PERFECTO DE CÉDULAS (CON LOS ACRÓNIMOS DE ALEGRA)
      let tipoAlegra = "CF"; // 01 -> Cédula Física por defecto
      if (tipoIdentificacion === "02") tipoAlegra = "CJ"; // Cédula Jurídica
      else if (tipoIdentificacion === "03") tipoAlegra = "DIMEX";
      else if (tipoIdentificacion === "04") tipoAlegra = "NITE";

      console.log("==================================================");
      console.log(`🔍 1. BUSCANDO CONTACTO EXISTENTE: ${cedulaLimpiada}`);
      
      const contactRes = await fetch(`https://api.alegra.com/api/v1/contacts?identification=${cedulaLimpiada}`, {
        headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
      });
      const contactsData = await contactRes.json();

      if (Array.isArray(contactsData) && contactsData.length > 0) {
        clientId = contactsData[0].id;
        console.log(`✅ 2. CONTACTO ENCONTRADO. ID: ${clientId}`);
        console.log(`🕵️ FORMATO DEL CONTACTO EN BASE DE DATOS:`, JSON.stringify(contactsData[0].identificationObject, null, 2));

        if (email && email.includes("@")) {
          await fetch(`https://api.alegra.com/api/v1/contacts/${clientId}`, {
            method: "PUT",
            headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() })
          });
        }
      } else {
        // 📦 CREAR CLIENTE NUEVO CON LOS ACRÓNIMOS EXACTOS
        const payloadNuevoContacto = {
          name: nombreCliente || "Cliente Electrónico",
          identificationObject: {
            type: tipoAlegra,
            number: cedulaLimpiada
          },
          email: (email && email.includes("@")) ? email.trim() : "",
          type: "client",
          address: {
            address: "Grecia centro",
            city: "Grecia",
            state: "Alajuela",
            country: "Costa Rica"
          }
        };

        console.log("⚠️ 2. CONTACTO NO ENCONTRADO. CREANDO NUEVO...");
        console.log("📦 PAYLOAD DE CONTACTO:", JSON.stringify(payloadNuevoContacto, null, 2));

        const newContactRes = await fetch(`https://api.alegra.com/api/v1/contacts`, {
          method: "POST",
          headers: { 
            "Authorization": `Basic ${credentials}`, 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payloadNuevoContacto)
        });
        
        const newContactData = await newContactRes.json();
        
        if (newContactRes.ok && newContactData.id) {
          clientId = newContactData.id;
          console.log(`✅ 3. CONTACTO CREADO CON ÉXITO. NUEVO ID: ${clientId}`);
        } else {
          console.error("❌ 3. ERROR AL CREAR CONTACTO:");
          console.error(JSON.stringify(newContactData, null, 2));
          console.log("⚠️ Usando cliente por defecto (ID: 2) para no frenar la venta.");
        }
      }
    }

    const itemsAlegra = [];
    let totalFactura = 0;
    let totalUnidadesGlobal = 0;
    ventas.forEach(v => totalUnidadesGlobal += (Number(v.totalUnidades) || 1));

    let precioUnitario = (Number(precioManual) && totalUnidadesGlobal > 0) ? (Number(precioManual) / totalUnidadesGlobal) : 10000;
    precioUnitario = Number(precioUnitario.toFixed(5));
    
    ventas.forEach((venta) => {
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      totalFactura += (precioUnitario * cantidadUnidades);

      if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          // 🔥 FIX: Línea corregida (antes tenía un salto de línea que rompía el string)
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

    totalFactura = Number(totalFactura.toFixed(2));
    const fechaActual = new Date().toISOString().split('T')[0];
    
    // 📄 PREPARAMOS LA FACTURA (INCLUYE ESPÍAS DE PAGOS)
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: { id: clientId },
      items: itemsAlegra,
      paymentCondition: "01", // 01 = Contado
      paymentForm: "04",      // 04 = Transferencia/SINPE Móvil (dejamos este para que el espía lo capture)
      status: "open",
      payments: [{ account: { id: 1 }, amount: totalFactura, date: fechaActual }]
    };

    if (tipo === "hacienda") {
      payloadAlegra.documentType = "04"; // Tiquete electrónico oficial
    } else {
      payloadAlegra.numberTemplate = { id: ID_NUMERACION_INTERNA };
    }

    console.log("==================================================");
    console.log("📄 4. PAYLOAD DE FACTURA ENVIADO A ALEGRA:");
    console.log(JSON.stringify(payloadAlegra, null, 2));

    const alegraResponse = await fetch("https://api.alegra.com/api/v1/invoices", {
      method: "POST",
      headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify(payloadAlegra)
    });

    const alegraData = await alegraResponse.json();
    
    if (!alegraResponse.ok) {
      console.error("❌ 5. ERROR DE ALEGRA AL EMITIR FACTURA:");
      console.error("🕵️ MOTIVO EXACTO DEL RECHAZO:", JSON.stringify(alegraData, null, 2));
      return res.status(400).json({ error: alegraData.message || "Error al generar factura en Alegra." });
    }

    console.log("✅ 5. FACTURA CREADA CON ÉXITO EN ALEGRA.");
    console.log("🕵️ RESPUESTA COMPLETA DE LA FACTURA:", JSON.stringify(alegraData, null, 2));
    console.log("==================================================");
    
    return res.status(200).json({ 
      success: true, 
      consecutivoOficial: alegraData.numberTemplate ? alegraData.numberTemplate.fullNumber : alegraData.id, 
      totalCobrado: totalFactura 
    });

  } catch (error) {
    console.error("❌ ERROR FATAL EN /emitir-tiquete:", error);
    res.status(500).json({ error: "Error del servidor al emitir tiquete." });
  }
});

export default router;