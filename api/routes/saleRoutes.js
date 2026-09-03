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
    console.log("➡️ [ANULAR] Solicitud para venta ID:", logId);

    // 1. Buscamos el registro en History
    const log = await History.findById(logId);
    if (!log) {
      return res.status(404).json({ error: "Registro de venta no encontrado en el historial." });
    }

    // 2. Limpiamos el nombre quitando categorías como (Player), (Fan), (Retro)
    const rawItemName = String(req.body?.item || log.item || "").trim();
    const cleanItemName = rawItemName.replace(/\(.*?\)/g, "").trim();

    // Función para comparar texto ignorando tildes y mayúsculas
    const normalize = (str) =>
      String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const targetClean = normalize(cleanItemName);

    // 3. Buscamos la camiseta en el catálogo de forma inteligente
    const allProducts = await Product.find({}, '_id name stock bodega');
    const product = allProducts.find((p) => {
      const pNorm = normalize(p.name);
      return pNorm === targetClean || pNorm.includes(targetClean) || targetClean.includes(pNorm);
    });

    if (!product) {
      console.log("❌ [ANULAR] Camiseta no encontrada en catálogo:", cleanItemName);
      return res.status(404).json({ 
        error: `No se encontró la camiseta "${cleanItemName}" en el catálogo para devolver las tallas.` 
      });
    }

    console.log("✅ [ANULAR] Camiseta encontrada:", product.name);

    // 4. Obtenemos las tallas y cantidades a devolver
    let prendas = [];
    if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
      prendas = req.body.items;
    } else {
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

    if (prendas.length === 0) {
      return res.status(400).json({ error: "No se detectaron tallas para restaurar en este registro." });
    }

    // 5. Sumamos las camisetas de vuelta a Tienda #1 o Tienda #2
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

    // 6. Guardado directo y forzado en MongoDB
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      { $set: { stock: updatedStock, bodega: updatedBodega } },
      { new: true }
    );

    console.log("💾 [ANULAR] Stock devuelto con éxito en MongoDB");

    // Notificar por WebSocket a todas las pantallas abiertas
    const io = req.app.get('io');
    if (io && updatedProduct) {
      io.emit('productoActualizado', updatedProduct.toObject());
    }

    // 7. Eliminamos la venta del historial (se descuenta de comisiones)
    await History.findByIdAndDelete(logId);
    console.log("✅ [ANULAR] Venta eliminada del historial con éxito.");

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