import express from 'express';

const router = express.Router();

const ALEGRA_EMAIL = "chemasport__er@outlook.com";
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
    .replace(/\s+/g, " ")
    .trim();
}

// Formatear un contacto de Alegra a un objeto limpio para el Frontend
function formatearContactoAlegra(c) {
  const tipoRaw = c.identificationObject?.type || "";
  let tipoIdentificacion = "01";
  if (tipoRaw === "CJ") tipoIdentificacion = "02";
  else if (tipoRaw === "DIMEX") tipoIdentificacion = "03";
  else if (tipoRaw === "NITE") tipoIdentificacion = "04";

  return {
    id: c.id,
    nombre: c.name || "",
    cedula: c.identificationObject?.number || c.identification || "",
    tipoIdentificacion,
    email: c.email || "",
    telefono: c.phonePrimary || c.mobile || ""
  };
}

// 🔥 FUNCIÓN QUE OBTIENE LOS IDs REALES DE TUS PRODUCTOS EN ALEGRA
async function obtenerMapaProductosAlegra(credentials) {
  if (cacheItemsAlegra && Object.keys(cacheItemsAlegra).length > 0) {
    return cacheItemsAlegra;
  }
  try {
    const res = await fetch("https://api.alegra.com/api/v1/items?start=0&limit=30", {
      headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
    });
    const data = await res.json();
    const lista = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    if (lista.length > 0) {
      const mapa = {};
      lista.forEach((item) => {
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
  return cacheItemsAlegra || {};
}

// 🔥 CLASIFICADOR OFICIAL: CONECTA CADA CATEGORÍA CON SU PRODUCTO DE ALEGRA Y SU PRECIO
function resolverProductoYPrecioBase(nombreVenta = "", mapaAlegra = {}) {
  const txt = limpiarTexto(nombreVenta);

  // Extraer lo que viene entre paréntesis, ej: "(Player)", "(Nacional)", "(Niño)", "(Mujer)"
  const parentesisMatches = [...txt.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim());
  const categoria = parentesisMatches.join(" ");

  let nombreProductoAlegra = "Camisa Version Fan"; // Predeterminado para Fan y el resto
  let precioBase = 20000;

  if (categoria.includes("envio") || txt.includes("envio gam") || txt === "envio" || txt.startsWith("envio ")) {
    nombreProductoAlegra = "Envio GAM";
    precioBase = 2500;
  } else if (categoria.includes("llavero") || txt.includes("llavero")) {
    nombreProductoAlegra = "Llavero Deportivo";
    precioBase = 2500;
  } else if (categoria.includes("mujer") || txt.includes("(mujer)") || txt.includes("dama") || txt.includes("crop top")) {
    nombreProductoAlegra = "Camisa Version Fan Mujer";
    precioBase = 20000;
  } else if (categoria.includes("nino") || txt.includes("(nino)") || txt.includes("uniforme de nino")) {
    nombreProductoAlegra = "Uniforme de Niño";
    precioBase = 20000;
  } else if (categoria.includes("nacional") || txt.includes("(nacional)")) {
    nombreProductoAlegra = "Camisa Nacional";
    precioBase = 22000;
  } else if (categoria.includes("player") || categoria.includes("jugador") || txt.includes("(player)")) {
    nombreProductoAlegra = "Camiseta Versión Jugador";
    precioBase = 22000;
  } else if (categoria.includes("retro") || txt.includes("(retro)")) {
    nombreProductoAlegra = "Camiseta Deportiva Versión Retro";
    precioBase = 22000;
  } else {
    // Fan ((Fan)) y todo el resto (NBA, MLB, NFL, F1, Balón, Abrigos, etc.)
    nombreProductoAlegra = "Camisa Version Fan";
    precioBase = 20000;
  }

  // Buscar el ID exacto en Alegra
  const claveBusqueda = limpiarTexto(nombreProductoAlegra);
  let idEnAlegra = mapaAlegra[claveBusqueda];

  if (!idEnAlegra) {
    const entradaParcial = Object.entries(mapaAlegra).find(
      ([k]) => k.includes(claveBusqueda) || claveBusqueda.includes(k)
    );
    if (entradaParcial) idEnAlegra = entradaParcial[1];
  }

  if (!idEnAlegra) {
    idEnAlegra =
      mapaAlegra["camisa version fan"] ||
      mapaAlegra["camiseta deportiva version fan"] ||
      ID_ITEM_FALLBACK;
  }

  return {
    idAlegra: idEnAlegra,
    nombreProductoAlegra,
    precioBase
  };
}

/* ========================================================
   ⭐ OBTENER / BUSCAR CONTACTOS Y FAVORITOS EN ALEGRA
   ======================================================== */
router.get('/contactos', async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');

    const url = q.length > 0
      ? `https://api.alegra.com/api/v1/contacts?query=${encodeURIComponent(q)}&type=client&limit=20`
      : `https://api.alegra.com/api/v1/contacts?type=client&limit=30`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) return res.json([]);
    const data = await response.json();
    const lista = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

    // Filtramos el contacto genérico "Cliente de Contado" (ID 2) para dejar solo clientes reales
    const contactosLimpios = lista
      .filter((c) => c && c.name && Number(c.id) !== 2 && limpiarTexto(c.name) !== "cliente de contado")
      .map(formatearContactoAlegra);

    return res.status(200).json(contactosLimpios);
  } catch (error) {
    console.error("⚠️ Error obteniendo contactos de Alegra:", error);
    return res.status(200).json([]);
  }
});

/* ========================================================
   🔍 CONSULTAR CÉDULA (PRIMERO EN ALEGRA, LUEGO EN HACIENDA)
   ======================================================== */
router.get('/consultar-cedula/:identificacion', async (req, res) => {
  try {
    const cedulaLimpia = String(req.params.identificacion || "").replace(/\D/g, "");
    if (!cedulaLimpia) return res.status(400).json({ error: "Cédula inválida." });

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');

    // 1. Primero buscamos si ya existe en Alegra para devolver también correo y teléfono
    try {
      const alegraRes = await fetch(`https://api.alegra.com/api/v1/contacts?identification=${cedulaLimpia}`, {
        headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
      });
      if (alegraRes.ok) {
        const alegraContacts = await alegraRes.json();
        if (Array.isArray(alegraContacts) && alegraContacts.length > 0) {
          const c = formatearContactoAlegra(alegraContacts[0]);
          return res.status(200).json({
            success: true,
            enAlegra: true,
            nombre: c.nombre,
            cedula: c.cedula,
            tipoIdentificacion: c.tipoIdentificacion,
            email: c.email,
            telefono: c.telefono
          });
        }
      }
    } catch (e) {
      console.warn("⚠️ Aviso buscando cédula en Alegra:", e.message);
    }

    // 2. Si no está en Alegra, consultamos en Hacienda
    const response = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${cedulaLimpia}`);
    if (!response.ok) return res.status(404).json({ error: "No se encontró información." });
    const data = await response.json();
    return res.status(200).json({
      success: true,
      enAlegra: false,
      nombre: data.nombre || "Cliente Electrónico"
    });
  } catch (error) {
    res.status(500).json({ error: "Error de consulta." });
  }
});

/* ========================================================
   🧾 EMITIR TIQUETE O FACTURA EN ALEGRA + ENVÍO AUTOMÁTICO DE CORREO
   ======================================================== */
router.post('/emitir-tiquete', async (req, res) => {
  try {
    const { ventas, tipo, precioManual, cedula, nombreCliente, email, telefono, tipoIdentificacion } = req.body; 
    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "Sin ventas." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    let clientId = 2; // Cliente de Contado / General por defecto en Alegra
    const correoLimpio = (email && email.includes("@")) ? email.trim() : "";

    // Limpiar guiones o espacios en cédula y teléfono
    const cedulaLimpiada = cedula ? String(cedula).replace(/\D/g, "") : "";
    const telefonoLimpiado = telefono ? String(telefono).replace(/\D/g, "") : "";

    if (cedulaLimpiada !== "") {
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
        if (correoLimpio) datosActualizar.email = correoLimpio;
        if (telefonoLimpiado) datosActualizar.phonePrimary = telefonoLimpiado;

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
          email: correoLimpio,
          type: "client"
        };

        if (telefonoLimpiado) {
          payloadNuevoContacto.phonePrimary = telefonoLimpiado;
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
    } else if (correoLimpio) {
      // Si es un tiquete sin cédula pero sí pusieron correo, actualizamos temporalmente el correo del cliente genérico (ID 2)
      try {
        await fetch(`https://api.alegra.com/api/v1/contacts/${clientId}`, {
          method: "PUT",
          headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: correoLimpio })
        });
      } catch (e) {
        console.log("⚠️ No se pudo actualizar email en cliente genérico:", e.message);
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

    // 🔥 OBTENER MAPA DE PRODUCTOS DE ALEGRA
    const mapaProductos = await obtenerMapaProductosAlegra(credentials);

    // 1. Armamos las líneas base con su respectivo Producto de Alegra y su Precio Oficial
    const lineasPreliminares = [];
    let sumaPreciosTabla = 0;

    ventas.forEach((venta) => {
      const cantidadUnidades = Number(venta.totalUnidades) || 1;
      const infoCat = resolverProductoYPrecioBase(venta.item, mapaProductos);

      const precioUnitarioDeEstaVenta = Number(venta.precioUnitarioCustom) > 0
        ? Number(venta.precioUnitarioCustom)
        : infoCat.precioBase;

      const esLineaEnvio = infoCat.nombreProductoAlegra === "Envio GAM";

      if (!esLineaEnvio && venta.items && Array.isArray(venta.items) && venta.items.length > 0) {
        venta.items.forEach((item) => {
          lineasPreliminares.push({
            id: infoCat.idAlegra,
            name: infoCat.nombreProductoAlegra,
            description: `${venta.item} (Talla: ${item.talla})`,
            precioBaseUnitario: precioUnitarioDeEstaVenta,
            quantity: 1,
            esEnvio: false
          });
          sumaPreciosTabla += precioUnitarioDeEstaVenta;
        });
      } else {
        lineasPreliminares.push({
          id: infoCat.idAlegra,
          name: infoCat.nombreProductoAlegra,
          description: esLineaEnvio ? "Servicio de Envío" : `${venta.item || "Camiseta Deportiva"}`,
          precioBaseUnitario: precioUnitarioDeEstaVenta,
          quantity: cantidadUnidades,
          esEnvio: esLineaEnvio
        });
        sumaPreciosTabla += (precioUnitarioDeEstaVenta * cantidadUnidades);
      }
    });

    // 2. Ajustamos al precioManual si fue modificado en el modal (sin alterar el monto de envío)
    const montoTotalDeseado = Number(precioManual) > 0 ? Number(precioManual) : sumaPreciosTabla;
    const diferencia = Math.abs(montoTotalDeseado - sumaPreciosTabla);

    const totalSoloEnvios = lineasPreliminares
      .filter((l) => l.esEnvio)
      .reduce((acc, l) => acc + (l.precioBaseUnitario * l.quantity), 0);
    const totalSoloPrendasBase = sumaPreciosTabla - totalSoloEnvios;
    const montoDeseadoParaPrendas = Math.max(0, montoTotalDeseado - totalSoloEnvios);
    const factorPrendas = totalSoloPrendasBase > 0 ? (montoDeseadoParaPrendas / totalSoloPrendasBase) : 1;

    let totalFactura = 0;
    const itemsAlegra = lineasPreliminares.map((linea) => {
      let precioFinalUnitario = linea.precioBaseUnitario;
      if (diferencia > 1 && !linea.esEnvio) {
        precioFinalUnitario = Number((linea.precioBaseUnitario * factorPrendas).toFixed(5));
      } else {
        precioFinalUnitario = Number(Number(linea.precioBaseUnitario).toFixed(5));
      }

      totalFactura += (precioFinalUnitario * linea.quantity);

      return {
        id: linea.id,
        name: linea.name,
        description: linea.description,
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
      saleCondition: "CASH",        
      paymentMethod: "TRANSFER",    
      status: "open",
      payments: [{ account: { id: 1 }, amount: totalFactura, date: fechaActual }],
      economicActivity: "4771.1"
    };

    if (tipo === "hacienda") {
      // 🔥 EMISIÓN Y TIMBRADO ELECTRÓNICO AUTOMÁTICO EN HACIENDA
      payloadAlegra.documentType = "04"; // Tiquete electrónico oficial (o Factura si tiene cédula)
      payloadAlegra.stamp = { generateStamp: true };
    } else {
      // 🔥 TIQUETE INTERNO (NO ELECTRÓNICO)
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

    console.log(`✅ 5. COMPROBANTE CREADO CON ÉXITO EN ALEGRA (ID: ${alegraData.id}).`);

    // 🔥 6. SI ES HACIENDA Y POR ALGUNA RAZÓN LA CUENTA REQUIERE FORZAR EL TIMBRADO POST-CREACIÓN
    if (tipo === "hacienda" && alegraData.id && (!alegraData.stamp || alegraData.stamp.legalStatus === "NOT_SENT")) {
      try {
        console.log("⚡ Timbrando electrónicamente ante Hacienda...");
        await fetch(`https://api.alegra.com/api/v1/invoices/stamp`, {
          method: "POST",
          headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [alegraData.id] })
        });
      } catch (stampErr) {
        console.warn("⚠️ Aviso al forzar stamp:", stampErr.message);
      }
    }

    // 🔥 7. ENVIAR POR CORREO AUTOMÁTICAMENTE DESDE ALEGRA (TANTO ELECTRÓNICAS COMO INTERNAS NO ELECTRÓNICAS)
    let correoEnviado = false;
    if (correoLimpio && alegraData.id) {
      try {
        console.log(`📧 6. ENVIANDO COMPROBANTE POR CORREO A: ${correoLimpio}...`);
        const emailRes = await fetch(`https://api.alegra.com/api/v1/invoices/${alegraData.id}/email`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            emails: [correoLimpio],
            sendCopyToUser: true
          })
        });

        const emailData = await emailRes.json().catch(() => ({}));
        if (emailRes.ok) {
          correoEnviado = true;
          console.log(`✅ 7. CORREO ENVIADO AUTOMÁTICAMENTE DESDE ALEGRA A ${correoLimpio}`);
        } else {
          console.warn("⚠️ Alegra no pudo despachar el correo:", JSON.stringify(emailData));
        }
      } catch (emailErr) {
        console.error("⚠️ Error al solicitar envío de correo a Alegra:", emailErr.message);
      }
    }

    console.log("==================================================");
    
    return res.status(200).json({ 
      success: true, 
      consecutivoOficial: alegraData.numberTemplate ? alegraData.numberTemplate.fullNumber : alegraData.id, 
      totalCobrado: totalFactura,
      correoEnviado
    });

  } catch (error) {
    console.error("❌ ERROR FATAL EN /emitir-tiquete:", error);
    res.status(500).json({ error: "Error del servidor al emitir tiquete." });
  }
});

export default router;