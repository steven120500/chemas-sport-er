import express from 'express';
import TiendaFactura from '../models/TiendaFactura.js';
import Product from '../models/Product.js';
import History from '../models/History.js';

const router = express.Router();

const ALEGRA_EMAIL = "emaespinoza21@gmail.com";
const ALEGRA_TOKEN = "134a1c740dd8a0185278";
const ID_NUMERACION_INTERNA = 1;
const ID_ITEM_FALLBACK = 8;

let cacheItemsAlegra = null;
let cacheImpuestoExentoId = null;

function limpiarTexto(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getHoyYMD() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/* ========================================================
   📦 FUNCIÓN OFICIAL PARA REBAJAR O DEVOLVER STOCK EN PRODUCT
   - "Tienda"   -> product.tienda
   - "Bodega 1" -> product.stock
   - "Bodega 2" -> product.bodega
   delta = -1 (rebajar al vender) | +1 (devolver al anular)
   ======================================================== */
async function ajustarStockPorUbicacion({
  productId,
  itemNombre = "",
  talla,
  ubicacion = "Tienda",
  cantidad = 1,
  delta = -1,
  vendedor = "Tienda",
  nombreCliente = "Cliente Tienda",
  crearHistorial = false,
  io = null
}) {
  try {
    if (!talla) return { product: null, historyId: null };

    let product = null;
    if (productId) {
      try {
        product = await Product.findById(productId);
      } catch {}
    }

    if (!product && itemNombre) {
      let nameQuery = String(itemNombre).trim();
      let typeQuery = null;
      const lastParen = nameQuery.lastIndexOf("(");
      if (lastParen !== -1) {
        typeQuery = nameQuery.substring(lastParen + 1, nameQuery.length - 1).trim();
        nameQuery = nameQuery.substring(0, lastParen).trim();
      }
      const escapedName = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const queryExact = { name: new RegExp(`^${escapedName}$`, "i") };
      if (typeQuery) queryExact.type = new RegExp(`^${typeQuery}$`, "i");
      product = await Product.findOne(queryExact);
      if (!product) {
        product = await Product.findOne({ name: new RegExp(escapedName, "i") });
      }
    }

    if (!product) return { product: null, historyId: null };

    const tallaLimpia = String(talla).replace(/^\d+x\s*/i, "").trim().toUpperCase();
    const ubiNorm = limpiarTexto(ubicacion);

    let campoDB = "tienda";
    let etiquetaHistorial = "Tienda";

    if (ubiNorm.includes("bodega 1") || ubiNorm.includes("bodega1") || ubiNorm === "stock") {
      campoDB = "stock";
      etiquetaHistorial = "Bodega 1";
    } else if (ubiNorm.includes("bodega 2") || ubiNorm.includes("bodega2") || ubiNorm === "bodega") {
      campoDB = "bodega";
      etiquetaHistorial = "Bodega 2";
    } else {
      campoDB = "tienda";
      etiquetaHistorial = "Tienda";
    }

    const objUbicacion = { ...(product[campoDB] || {}) };
    const claveReal = Object.keys(objUbicacion).find(
      (k) => k.trim().toUpperCase() === tallaLimpia
    ) || tallaLimpia;

    const antes = Number(objUbicacion[claveReal] ?? 0);
    const cambio = Number(cantidad) * Number(delta);
    const despues = Math.max(0, Math.trunc(antes + cambio));

    objUbicacion[claveReal] = despues;
    product[campoDB] = objUbicacion;
    product.markModified(campoDB);

    if (delta < 0 && antes > despues) {
      const restadas = antes - despues;
      if (!Array.isArray(product.popularCountHistory)) {
        product.popularCountHistory = [];
      }
      product.popularCountHistory.push({ date: new Date().toISOString(), quantity: restadas });
      const now = new Date();
      const totalMonth = product.popularCountHistory
        .filter((entry) => {
          const d = new Date(entry.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, e) => sum + Number(e.quantity || 0), 0);
      product.isPopular = totalMonth >= 10;
    }

    await product.save();

    let historyDoc = null;
    if (crearHistorial && delta < 0) {
      const detalleText = `👤 Cliente: ${nombreCliente || "Cliente Tienda"} | [ID:${product._id}] | ${etiquetaHistorial}[${claveReal}]: ${antes} → ${despues}`;
      historyDoc = await History.create({
        productId: product._id,
        user: vendedor || "Tienda",
        action: "vendió / rebajó stock",
        item: `${product.name} (${product.type})`,
        date: new Date(),
        details: detalleText
      });
    }

    const updatedObj = product.toObject();
    if (io) {
      io.emit('productoActualizado', updatedObj);
    }

    return {
      product: updatedObj,
      historyId: historyDoc ? String(historyDoc._id) : null
    };
  } catch (err) {
    console.error("⚠️ Error ajustando stock en Tienda:", err);
    return { product: null, historyId: null };
  }
}

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
      return mapa;
    }
  } catch (err) {
    console.error("⚠️ Error consultando ítems de Alegra en Tienda:", err);
  }
  return cacheItemsAlegra || {};
}

function resolverProductoYPrecioBase(nombreVenta = "", mapaAlegra = {}) {
  const txt = limpiarTexto(nombreVenta);
  const parentesisMatches = [...txt.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim());
  const categoria = parentesisMatches.join(" ");

  let nombreProductoAlegra = "Camisa Version Fan";
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
  }

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

  return { idAlegra: idEnAlegra, nombreProductoAlegra, precioBase };
}

router.get('/resumen', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || getHoyYMD()).trim();
    const facturas = await TiendaFactura.find({ fechaYMD: fecha }).sort({ createdAt: -1 });

    let totalEfectivo = 0;
    let totalDatafono = 0;
    let totalSinpe = 0;
    let totalGeneral = 0;

    facturas.forEach((f) => {
      totalEfectivo += Number(f.montoEfectivo || 0);
      totalDatafono += Number(f.montoDatafono || 0);
      totalSinpe += Number(f.montoSinpe || 0);
      totalGeneral += Number(f.totalCobrado || 0);
    });

    return res.status(200).json({
      fecha,
      resumen: {
        efectivo: totalEfectivo,
        datafono: totalDatafono,
        sinpe: totalSinpe,
        total: totalGeneral,
        cantidadFacturas: facturas.length
      },
      facturas
    });
  } catch (error) {
    console.error("❌ Error obteniendo resumen de tienda:", error);
    return res.status(500).json({ error: "Error obteniendo datos de la tienda." });
  }
});

router.post('/emitir', async (req, res) => {
  try {
    const {
      ventas,
      tipo = "hacienda",
      precioManual,
      cedula,
      nombreCliente,
      email,
      telefono,
      tipoIdentificacion = "01",
      metodoPago = "Efectivo",
      montoEfectivo = 0,
      montoDatafono = 0,
      montoSinpe = 0,
      fechaYMD
    } = req.body;

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: "No hay artículos seleccionados para facturar." });
    }

    const credentials = Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_TOKEN}`).toString('base64');
    let clientId = 2;
    const correoLimpio = (email && email.includes("@")) ? email.trim() : "";
    const cedulaLimpiada = cedula ? String(cedula).replace(/\D/g, "") : "";
    const telefonoLimpiado = telefono ? String(telefono).replace(/\D/g, "") : "";

    if (cedulaLimpiada !== "") {
      let tipoAlegra = "CF";
      if (tipoIdentificacion === "02") tipoAlegra = "CJ";
      else if (tipoIdentificacion === "03") tipoAlegra = "DIMEX";
      else if (tipoIdentificacion === "04") tipoAlegra = "NITE";

      const contactRes = await fetch(`https://api.alegra.com/api/v1/contacts?identification=${cedulaLimpiada}`, {
        headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" }
      });
      const contactsData = await contactRes.json();

      if (Array.isArray(contactsData) && contactsData.length > 0) {
        clientId = contactsData[0].id;
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
        const payloadNuevoContacto = {
          name: nombreCliente || "Cliente Electrónico",
          identificationObject: { type: tipoAlegra, number: cedulaLimpiada },
          email: correoLimpio,
          type: "client"
        };
        if (telefonoLimpiado) payloadNuevoContacto.phonePrimary = telefonoLimpiado;

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
        }
      }
    }

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
          }
        }
      } catch (e) {}
    }

    const mapaProductos = await obtenerMapaProductosAlegra(credentials);
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

    let paymentMethodAlegra = "CASH";
    if (metodoPago === "Datáfono") paymentMethodAlegra = "CARD";
    else if (metodoPago === "SINPE" || metodoPago === "Mixto") paymentMethodAlegra = "TRANSFER";

    const construirPayloadAlegra = (metodo) => {
      const p = {
        date: fechaActual,
        dueDate: fechaActual,
        client: { id: clientId },
        items: itemsAlegra,
        saleCondition: "CASH",
        paymentMethod: metodo,
        status: "open",
        payments: [{ account: { id: 1 }, amount: totalFactura, date: fechaActual }]
      };
      if (tipo === "hacienda") {
        p.documentType = "04";
        p.stamp = { generateStamp: true };
      } else {
        p.numberTemplate = { id: ID_NUMERACION_INTERNA };
      }
      return p;
    };

    let alegraResponse = await fetch("https://api.alegra.com/api/v1/invoices", {
      method: "POST",
      headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify(construirPayloadAlegra(paymentMethodAlegra))
    });

    let alegraData = await alegraResponse.json();

    if (!alegraResponse.ok && metodoPago === "Datáfono") {
      alegraResponse = await fetch("https://api.alegra.com/api/v1/invoices", {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
        body: JSON.stringify(construirPayloadAlegra("TRANSFER"))
      });
      alegraData = await alegraResponse.json();
    }

    if (!alegraResponse.ok) {
      return res.status(400).json({ error: alegraData.message || "Error al generar factura en Alegra." });
    }

    if (tipo === "hacienda" && alegraData.id && (!alegraData.stamp || alegraData.stamp.legalStatus === "NOT_SENT")) {
      try {
        await fetch(`https://api.alegra.com/api/v1/invoices/stamp`, {
          method: "POST",
          headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [alegraData.id] })
        });
      } catch (e) {}
    }

    let correoEnviado = false;
    if (correoLimpio && alegraData.id) {
      try {
        const emailRes = await fetch(`https://api.alegra.com/api/v1/invoices/${alegraData.id}/email`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ emails: [correoLimpio], sendCopyToUser: true })
        });
        if (emailRes.ok) correoEnviado = true;
      } catch (e) {}
    }

    const consecutivoOficial = alegraData.numberTemplate
      ? alegraData.numberTemplate.fullNumber
      : String(alegraData.id);

    // 🔥 REBAJAR STOCK
    const io = req.app.get('io');
    const historyIdsCreados = [];

    for (const v of ventas) {
      const ubicacionVenta = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
      const tallaVenta = v.talla || (v.items && v.items[0]?.talla) || v.tallasTexto;
      const cantVenta = Number(v.totalUnidades) || 1;

      if (tallaVenta && !String(v.item || "").toLowerCase().includes("envio gam")) {
        const resultado = await ajustarStockPorUbicacion({
          productId: v.productId,
          itemNombre: v.item,
          talla: tallaVenta,
          ubicacion: ubicacionVenta,
          cantidad: cantVenta,
          delta: -1,
          vendedor: v.vendedor || "Tienda",
          nombreCliente: nombreCliente || "Cliente Tienda",
          crearHistorial: true,
          io
        });

        if (resultado.historyId) {
          historyIdsCreados.push(resultado.historyId);
        }
      }
    }

    let efec = 0, dataf = 0, sinp = 0;
    if (metodoPago === "Efectivo") efec = totalFactura;
    else if (metodoPago === "Datáfono") dataf = totalFactura;
    else if (metodoPago === "SINPE") sinp = totalFactura;
    else if (metodoPago === "Mixto") {
      efec = Number(montoEfectivo) || 0;
      dataf = Number(montoDatafono) || 0;
      sinp = Number(montoSinpe) || 0;
    }

    const ahora = new Date();
    const diaRegistro = fechaYMD || getHoyYMD();
    const fechaHoraStr = ahora.toLocaleString("es-CR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const nuevaFacturaTienda = await TiendaFactura.create({
      fechaYMD: diaRegistro,
      fechaHora: fechaHoraStr,
      consecutivoOficial,
      alegraId: String(alegraData.id || ""),
      tipoEmision: tipo,
      cliente: {
        nombre: nombreCliente || "Cliente de Contado",
        cedula: cedulaLimpiada,
        tipoIdentificacion,
        telefono: telefonoLimpiado,
        correo: correoLimpio
      },
      metodoPago,
      montoEfectivo: efec,
      montoDatafono: dataf,
      montoSinpe: sinp,
      totalCobrado: totalFactura,
      ventas,
      vendedor: ventas[0]?.vendedor || "Tienda",
      historyIds: historyIdsCreados
    });

    return res.status(200).json({
      success: true,
      consecutivoOficial,
      totalCobrado: totalFactura,
      correoEnviado,
      facturaTienda: nuevaFacturaTienda
    });
  } catch (error) {
    console.error("❌ ERROR EN /api/tienda/emitir:", error);
    return res.status(500).json({ error: "Error del servidor al facturar en tienda." });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const factura = await TiendaFactura.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Registro no encontrado." });

    const io = req.app.get('io');
    const devoluciones = [];

    if (Array.isArray(factura.ventas)) {
      for (const v of factura.ventas) {
        if (v && (v.productId || v.item)) {
          const ubicacionOrigen = v.ubicacion || (v.items && v.items[0]?.tienda) || "Tienda";
          const tallaOrigen = v.talla || (v.items && v.items[0]?.talla) || v.tallasTexto;
          const cantOrigen = Number(v.totalUnidades) || 1;

          if (tallaOrigen && !String(v.item || "").toLowerCase().includes("envio gam")) {
            await ajustarStockPorUbicacion({
              productId: v.productId,
              itemNombre: v.item,
              talla: tallaOrigen,
              ubicacion: ubicacionOrigen,
              cantidad: cantOrigen,
              delta: 1, // Devolver stock
              io
            });
            devoluciones.push(`${cantOrigen}x ${v.item} (Talla ${tallaOrigen}) → ${ubicacionOrigen}`);
          }
        }
      }
    }

    if (Array.isArray(factura.historyIds) && factura.historyIds.length > 0) {
      await History.deleteMany({ _id: { $in: factura.historyIds } }).catch(() => {});
    }

    await TiendaFactura.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, devoluciones });
  } catch (error) {
    console.error("❌ Error al anular factura de tienda:", error);
    return res.status(500).json({ error: "No se pudo anular el registro." });
  }
});

export default router;