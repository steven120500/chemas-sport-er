import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";

// ID DE LA NUMERACIÓN INTERNA (NO ELECTRÓNICA)
const ID_NUMERACION_INTERNA = 1; 
const ID_ITEM_FALLBACK = 8; // Respaldo por defecto

// Caché en memoria para no consultar los ítems e impuestos en cada factura
let cacheItemsAlegra = null;
let cacheImpuestoExentoId = null;

// Normalizar texto (sin tildes, en minúsculas) para comparar nombres sin fallos
function limpiarTexto(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// 🔥 FUNCIÓN QUE OBTIENE LOS IDs REALES DE TUS PRODUCTOS EN ALEGRA
async function obtenerMapaProductosAlegra(credentials) {
  if (cacheItemsAlegra) return cacheItemsAlegra;
  try {
    const res = await fetch("https://api.alegra.com/api/v1/items?limit=30", {
      headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const mapa = {};
      data.forEach((item) => {
        if (item && item.name && item.id) {
          mapa[limpiarTexto(item.name)] = Number(item.id);
        }
      });
      cacheItemsAlegra = mapa;
      console.log("✅ MAPA DE PRODUCTOS ALEGRA CARGADO:", mapa);
      return mapa;
    }
  } catch (err) {
    console.error("⚠️ Error consultando ítems de Alegra:", err);
  }
  return {};
}

// 🔥 CLASIFICADOR OFICIAL: CONECTA CADA CATEGORÍA CON SU PRODUCTO DE ALEGRA Y SU PRECIO
function resolverProductoYPrecioBase(nombreVenta = "", mapaAlegra = {}) {
  const txt = limpiarTexto(nombreVenta);

  // Extraer lo que viene entre paréntesis al final, ej: "(Player)", "(Nacional)", "(Niño)"
  const matchParentesis = txt.match(/\(([^)]+)\)\s*$/);
  const categoria = matchParentesis ? matchParentesis[1].trim() : "";

  let nombreProductoAlegra = "Camisa Version Fan"; // Predeterminado para Fan y el resto
  let precioBase = 20000;

  if (categoria.includes("nacional") || txt.includes("(nacional)")) {
    nombreProductoAlegra = "Camisa Nacional";
    precioBase = 22000;
  } else if (categoria.includes("player") || categoria.includes("jugador") || txt.includes("(player)")) {
    nombreProductoAlegra = "Camiseta Versión Jugador";
    precioBase = 22000;
  } else if (categoria.includes("retro") || txt.includes("(retro)")) {
    nombreProductoAlegra = "Camiseta Deportiva Versión Retro";
    precioBase = 22000;
  } else if (categoria.includes("mujer") || txt.includes("(mujer)")) {
    nombreProductoAlegra = "Camisa Version Fan Mujer";
    precioBase = 20000;
  } else if (categoria.includes("nino") || txt.includes("(nino)") || txt.includes("uniforme de nino")) {
    nombreProductoAlegra = "Uniforme de Niño";
    precioBase = 20000;
  } else if (categoria.includes("llavero") || txt.includes("llavero")) {
    nombreProductoAlegra = "Llavero Deportivo";
    precioBase = 2500;
  } else if (categoria.includes("envio") || txt.includes("envio gam") || txt.startsWith("envio")) {
    nombreProductoAlegra = "Envio GAM";
    precioBase = 2500;
  } else {
    // Fan ((Fan)) y todo el resto (NBA, MLB, NFL, F1, Balón, Abrigos, etc.)
    nombreProductoAlegra = "Camisa Version Fan";
    precioBase = 20000;
  }

  // Buscar el ID exacto en Alegra
  const claveBusqueda = limpiarTexto(nombreProductoAlegra);
  const idEnAlegra =
    mapaAlegra[claveBusqueda] ||
    mapaAlegra["camisa version fan"] ||
    mapaAlegra["camiseta deportiva version fan"] ||
    ID_ITEM_FALLBACK;

  return {
    idAlegra: idEnAlegra,
    nombreProductoAlegra,
    precioBase
  };
}

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
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas, tipo, precioManual, cedula, nombreCliente, email, telefono, tipoIdentificacion } = req.body; 
    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "Sin ventas." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    let clientId = 2; // Cliente de Contado / General por defecto en Alegra

    if (cedula && cedula.trim() !== "") {
      const cedulaLimpiada = cedula.trim();

      // 🔥 TRADUCTOR PERFECTO DE CÉDULAS
      let tipoAlegra = "CF"; 
      if (tipoIdentificacion === "02") tipoAlegra = "CJ"; 
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

        // Actualizar correo y/o teléfono si se enviaron en el modal
        const datosActualizar = {};
        if (email && email.includes("@")) datosActualizar.email = email.trim();
        if (telefono && telefono.trim() !== "") datosActualizar.phonePrimary = telefono.trim();

        if (Object.keys(datosActualizar).length > 0) {
          await fetch(`https://api.alegra.com/api/v1/contacts/${clientId}`, {
            method: "PUT",
            headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
            body: JSON.stringify(datosActualizar)
          });
        }
      } else {
        // 📦 CREAR CLIENTE NUEVO
        const payloadNuevoContacto = {
          name: nombreCliente || "Cliente Electrónico",
          identificationObject: {
            type: tipoAlegra,
            number: cedulaLimpiada
          },
          email: (email && email.includes("@")) ? email.trim() : "",
          type: "client"
        };

        if (telefono && telefono.trim() !== "") {
          payloadNuevoContacto.phonePrimary = telefono.trim();
        }

        console.log("⚠️ 2. CONTACTO NO ENCONTRADO. CREANDO NUEVO...");
        
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
        }
      }
    }

    // 🔥 BUSCAR DINÁMICAMENTE EL IMPUESTO "IVA EXENTO 0%" (Con caché)
    let idImpuestoExento = cacheImpuestoExentoId || 2;
    if (!cacheImpuestoExentoId) {
      try {
        const taxesRes = await fetch("https://api.alegra.com/api/v1/taxes", {
          headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
        });
        const taxesData = await taxesRes.json();
        if (Array.isArray(taxesData)) {
          const impuesto = taxesData.find(t => t.name.toLowerCase().includes("exento") || Number(t.percentage) === 0);
          if (impuesto) {
            idImpuestoExento = impuesto.id;
            cacheImpuestoExentoId = impuesto.id;
            console.log(`✅ IMPUESTO EXENTO ENCONTRADO. ID: ${idImpuestoExento}`);
          }
        }
      } catch (e) {
        console.log("⚠️ No se pudo buscar el impuesto, usando el ID 2 por defecto.");
      }
    }

    // 🔥 OBTENER MAPA DE PRODUCTOS DE ALEGRA (Camisa Nacional, Player, Retro, Fan, Mujer, Niño, Llavero, Envío)
    const mapaProductos = await obtenerMapaProductosAlegra(credentials);

    // 1. Armamos las líneas base con su respectivo Producto de Alegra y su Precio Oficial
    const lineasPreliminares = [];
    let sumaPreciosTabla = 0;

    ventas.forEach((venta) => {
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      const infoCat = resolverProductoYPrecioBase(venta.item, mapaProductos);

      // Si desde el frontend venía un precio personalizado por fila, lo usamos; si no, usamos el de la categoría
      const precioUnitarioDeEstaVenta = Number(venta.precioUnitarioCustom) > 0
        ? Number(venta.precioUnitarioCustom)
        : infoCat.precioBase;

      if (venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          lineasPreliminares.push({
            id: infoCat.idAlegra,
            // Se envía el nombre del producto en Alegra o el detalle con talla
            name: `${infoCat.nombreProductoAlegra} - ${venta.item} (Talla: ${item.talla})`,
            precioBaseUnitario: precioUnitarioDeEstaVenta,
            quantity: 1
          });
          sumaPreciosTabla += precioUnitarioDeEstaVenta;
        });
      } else {
        lineasPreliminares.push({
          id: infoCat.idAlegra,
          name: `${infoCat.nombreProductoAlegra} - ${venta.item || "Camiseta Deportiva"}`,
          precioBaseUnitario: precioUnitarioDeEstaVenta,
          quantity: cantidadUnidades
        });
        sumaPreciosTabla += (precioUnitarioDeEstaVenta * cantidadUnidades);
      }
    });

    // 2. Ajustamos al precioManual que se envió desde el modal (sin importar el precio fijo que tenga en Alegra)
    const montoTotalDeseado = Number(precioManual) > 0 ? Number(precioManual) : sumaPreciosTabla;
    const factorAjuste = sumaPreciosTabla > 0 ? (montoTotalDeseado / sumaPreciosTabla) : 1;

    let totalFactura = 0;
    const itemsAlegra = lineasPreliminares.map((linea) => {
      const precioFinalUnitario = Number((linea.precioBaseUnitario * factorAjuste).toFixed(5));
      totalFactura += (precioFinalUnitario * linea.quantity);

      return {
        id: linea.id,
        name: linea.name,
        price: precioFinalUnitario,
        quantity: linea.quantity,
        tax: [{ id: idImpuestoExento }]
      };
    });

    totalFactura = Number(totalFactura.toFixed(2));
    const fechaActual = new Date().toISOString().split('T')[0];
    
    // 📄 PREPARAMOS LA FACTURA
    const payloadAlegra = {
      date: fechaActual,
      dueDate: fechaActual,
      client: { id: clientId },
      items: itemsAlegra,
      
      // LA COMBINACIÓN MÁGICA PARA CONTADO + SINPE/TRANSFERENCIA
      saleCondition: "CASH",        
      paymentMethod: "TRANSFER",    
      
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
      console.error(JSON.stringify(alegraData, null, 2));
      return res.status(400).json({ error: alegraData.message || "Error al generar factura en Alegra." });
    }

    console.log("✅ 5. FACTURA CREADA CON ÉXITO EN ALEGRA.");
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