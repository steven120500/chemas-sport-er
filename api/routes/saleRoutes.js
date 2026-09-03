import express from 'express';
import History from '../models/History.js';
import Product from '../models/Product.js';

const router = express.Router();

/* ========================================================
   🗑️ ANULAR VENTA: Devuelve el stock (Por ID o por Nombre)
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

    const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");

    // 2. Intentamos obtener el ID exacto del producto (del body, del modelo o del texto)
    let productId = req.body?.productId || log?.productId;
    if (!productId) {
      const mId = detailsStr.match(/\[ID:([a-f0-9]{24})\]/i) || detailsStr.match(/ID:([a-f0-9]{24})/i);
      if (mId && mId) productId = mId;
    }

    let product = null;

    // 🎯 PRIORIDAD 1: Búsqueda infalible por ID de MongoDB
    if (productId) {
      product = await Product.findById(productId);
      if (product) {
        console.log("🎯 [ANULAR] ¡Camiseta encontrada por ID exacto!:", product.name);
      }
    }

    // 🔍 PRIORIDAD 2: Respaldo por nombre inteligente si no tenía ID
    if (!product) {
      const rawItemName = String(req.body?.item || log.item || "").trim();
      const cleanItemName = rawItemName.replace(/\s*\([^)]*\)$/, "").trim();

      const normalize = (str) =>
        String(str || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .trim();

      const targetWords = normalize(cleanItemName).split(/\s+/).filter(w => w.length > 1);
      const allProducts = await Product.find({}, '_id name stock bodega');

      let maxMatches = 0;
      for (const p of allProducts) {
        const pNorm = normalize(p.name);
        if (pNorm === normalize(cleanItemName) || pNorm === normalize(rawItemName)) {
          product = p;
          break;
        }

        const matches = targetWords.filter(word => pNorm.includes(word)).length;
        if (matches > maxMatches && matches >= 2) {
          maxMatches = matches;
          product = p;
        }
      }
    }

    if (!product) {
      console.log("❌ [ANULAR] No se encontró la camiseta en el catálogo.");
      return res.status(404).json({ 
        error: "No se encontró la camiseta en el catálogo para devolver el stock." 
      });
    }

    console.log("✅ [ANULAR] Camiseta confirmada:", product.name);

    // 3. Obtenemos las tallas y tiendas a devolver
    let prendas = [];
    if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
      prendas = req.body.items.filter(it => it.talla && it.talla !== "U");
    }

    if (prendas.length === 0) {
      const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/gi;
      let m;
      while ((m = regex.exec(detailsStr)) !== null) {
        const [, tallaCapturada, oldStr, newStr] = m;
        const talla = String(tallaCapturada || "").trim().toUpperCase();
        const oldV = parseInt(oldStr, 10) || 0;
        const newV = parseInt(newStr, 10) || 0;
        const subStr = detailsStr.substring(0, m.index);
        const tienda = subStr.includes("Tienda #2") ? "Tienda #2" : "Tienda #1";

        if (oldV > newV && talla && talla !== "U") {
          const cantidad = oldV - newV;
          for (let i = 0; i < cantidad; i++) {
            prendas.push({ tienda, talla });
          }
        }
      }
    }

    if (prendas.length === 0) {
      return res.status(400).json({ error: "No se detectaron tallas válidas para devolver en este registro." });
    }

    console.log("📦 [ANULAR] Tallas a devolver:", prendas);

    // 4. Sumamos las unidades al stock o bodega correspondiente
    const updatedStock = { ...(product.stock || {}) };
    const updatedBodega = { ...(product.bodega || {}) };

    prendas.forEach(({ tienda, talla }) => {
      const tUpper = String(talla || "").trim().toUpperCase();
      if (tUpper && tUpper !== "U") {
        const t = String(tienda || "");
        if (t.includes("Tienda #2") || t.toLowerCase().includes("bodega")) {
          updatedBodega[tUpper] = (Number(updatedBodega[tUpper]) || 0) + 1;
        } else {
          updatedStock[tUpper] = (Number(updatedStock[tUpper]) || 0) + 1;
        }
      }
    });

    // 5. Guardado directo en MongoDB con findByIdAndUpdate
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      { $set: { stock: updatedStock, bodega: updatedBodega } },
      { new: true }
    );

    console.log("💾 [ANULAR] Stock restablecido exitosamente para:", updatedProduct.name);

    // 6. Notificar por WebSocket a todas las pantallas abiertas
    const io = req.app.get('io');
    if (io && updatedProduct) {
      io.emit('productoActualizado', updatedProduct.toObject());
    }

    // 7. Eliminamos el registro del historial (se descuenta del ranking)
    await History.findByIdAndDelete(logId);
    console.log("✅ [ANULAR] Venta eliminada del historial con éxito.");

    return res.status(200).json({ 
      success: true, 
      message: `Venta anulada. Se devolvió el stock a ${updatedProduct.name}.` 
    });

  } catch (error) {
    console.error("❌ [ANULAR] Error fatal:", error);
    return res.status(500).json({ error: "Error en el servidor al anular: " + error.message });
  }
});

export default router;