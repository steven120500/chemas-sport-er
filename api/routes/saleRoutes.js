import express from 'express';
import History from '../models/History.js';
import Product from '../models/Product.js';

const router = express.Router();

/* ========================================================
   🗑️ ANULAR VENTA: Devuelve el stock y elimina de comisiones
   ======================================================== */
router.post('/anular/:id', async (req, res) => {
  try {
    const logId = req.params.id;
    console.log("➡️ [ANULAR] Solicitud recibida para log ID:", logId);

    // 1. Buscamos el registro en la colección History
    const log = await History.findById(logId);
    if (!log) {
      console.log("❌ [ANULAR] El registro no existe en History:", logId);
      return res.status(404).json({ error: "Registro de venta no encontrado en el historial." });
    }

    const itemName = String(req.body?.item || log.item || "").trim();
    const cleanItemName = itemName.split("(")[0].trim();
    console.log("🔍 [ANULAR] Buscando producto:", { itemName, cleanItemName });

    // 2. Buscamos el producto en MongoDB (por nombre completo o sin categoría)
    let product = await Product.findOne({ name: itemName });
    if (!product) {
      product = await Product.findOne({ name: cleanItemName });
    }
    if (!product) {
      const escaped = cleanItemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      product = await Product.findOne({ name: new RegExp(escaped, "i") });
    }

    // 3. Extraemos las tallas y cantidades a devolver
    let prendas = [];
    if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
      prendas = req.body.items;
    } else {
      // Respaldo leyendo los detalles de texto
      const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");
      const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/gi;
      let m;
      while ((m = regex.exec(detailsStr)) !== null) {
        const talla = String(m || "U").trim();
        const oldV = parseInt(m, 10) || 0;
        const newV = parseInt(m, 10) || 0;
        const subStr = detailsStr.substring(0, m.index);
        const tienda = subStr.includes("Tienda #2") ? "Tienda #2" : "Tienda #1";

        if (oldV > newV) {
          const cantidad = oldV - newV;
          for (let i = 0; i < cantidad; i++) {
            prendas.push({ tienda, talla });
          }
        }
      }
    }

    console.log("📦 [ANULAR] Prendas detectadas para devolver:", prendas);

    // 4. Si encontramos el producto, le sumamos las unidades de vuelta
    if (product && prendas.length > 0) {
      const updatedStock = { ...(product.stock || {}) };
      const updatedBodega = { ...(product.bodega || {}) };

      prendas.forEach(({ tienda, talla }) => {
        if (talla && talla !== "U") {
          const t = String(tienda || "");
          if (t.includes("Tienda #2") || t.toLowerCase().includes("bodega")) {
            updatedBodega[talla] = (Number(updatedBodega[talla]) || 0) + 1;
          } else {
            updatedStock[talla] = (Number(updatedStock[talla]) || 0) + 1;
          }
        }
      });

      product.stock = updatedStock;
      product.bodega = updatedBodega;

      // Forzar a Mongoose a guardar objetos modificados
      product.markModified('stock');
      product.markModified('bodega');
      await product.save();
      console.log("💾 [ANULAR] Stock guardado en MongoDB con éxito para:", product.name);

      // Notificar por WebSocket a todas las pantallas abiertas
      const io = req.app.get('io');
      if (io) {
        io.emit('productoActualizado', product.toObject());
      }
    } else if (!product) {
      console.log("⚠️ [ANULAR] El producto ya no existe en el catálogo. Se borrará solo del historial.");
    }

    // 5. Eliminamos la venta de History (se descuenta de comisiones de inmediato)
    await History.findByIdAndDelete(logId);
    console.log("✅ [ANULAR] Venta eliminada de History exitosamente.");

    return res.status(200).json({ 
      success: true, 
      message: "Venta anulada y stock devuelto exitosamente." 
    });

  } catch (error) {
    console.error("❌ [ANULAR] Error fatal:", error);
    return res.status(500).json({ error: "Error en el servidor al anular: " + error.message });
  }
});

export default router;