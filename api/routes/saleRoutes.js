import express from 'express';
import History from '../models/History.js';
import Product from '../models/Product.js';

const router = express.Router();

/* ========================================================
   🗑️ ANULAR VENTA: Devuelve el stock (Nuevas y Viejas)
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

    // 2. Quitamos ÚNICAMENTE la categoría del final (Player, Fan, Retro) manteniendo el nombre del jugador
    const rawItemName = String(req.body?.item || log.item || "").trim();
    const cleanItemName = rawItemName.replace(/\s*\([^)]*\)$/, "").trim();

    // Normalizador de texto (quita tildes, signos y pasa a minúsculas)
    const normalize = (str) =>
      String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .trim();

    const targetWords = normalize(cleanItemName).split(/\s+/).filter(w => w.length > 1);

    // 3. Búsqueda inteligente en todo el catálogo
    const allProducts = await Product.find({}, '_id name stock bodega');
    
    let bestProduct = null;
    let maxMatches = 0;

    for (const p of allProducts) {
      const pNorm = normalize(p.name);
      // Coincidencia exacta directa
      if (pNorm === normalize(cleanItemName) || pNorm === normalize(rawItemName)) {
        bestProduct = p;
        break;
      }

      // Conteo de palabras coincidentes para chemas viejas
      const matches = targetWords.filter(word => pNorm.includes(word)).length;
      if (matches > maxMatches && matches >= 2) {
        maxMatches = matches;
        bestProduct = p;
      }
    }

    if (!bestProduct) {
      console.log("❌ [ANULAR] No se encontró en catálogo:", cleanItemName);
      return res.status(404).json({ 
        error: `No se encontró la camiseta "${cleanItemName}" en el inventario para devolver el stock.` 
      });
    }

    console.log("✅ [ANULAR] Camiseta identificada:", bestProduct.name);

    // 4. Obtenemos las tallas y tiendas a devolver
    let prendas = [];
    if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
      prendas = req.body.items.filter(it => it.talla && it.talla !== "U");
    }

    if (prendas.length === 0) {
      const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");
      const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/gi;
      let m;
      while ((m = regex.exec(detailsStr)) !== null) {
        const [, tallaCapturada, oldStr, newStr] = m;
        const talla = String(tallaCapturada || "").trim();
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

    console.log("📦 [ANULAR] Tallas que se devolverán:", prendas);

    // 5. Sumamos las unidades al stock o bodega correspondiente
    const updatedStock = { ...(bestProduct.stock || {}) };
    const updatedBodega = { ...(bestProduct.bodega || {}) };

    prendas.forEach(({ tienda, talla }) => {
      const t = String(tienda || "");
      if (t.includes("Tienda #2") || t.toLowerCase().includes("bodega")) {
        updatedBodega[talla] = (Number(updatedBodega[talla]) || 0) + 1;
      } else {
        updatedStock[talla] = (Number(updatedStock[talla]) || 0) + 1;
      }
    });

    // 6. Guardado directo en MongoDB con findByIdAndUpdate
    const updatedProduct = await Product.findByIdAndUpdate(
      bestProduct._id,
      { $set: { stock: updatedStock, bodega: updatedBodega } },
      { new: true }
    );

    console.log("💾 [ANULAR] Stock restablecido exitosamente para:", updatedProduct.name);

    // Emitir WebSocket a todas las pantallas abiertas
    const io = req.app.get('io');
    if (io && updatedProduct) {
      io.emit('productoActualizado', updatedProduct.toObject());
    }

    // 7. Eliminamos el registro del historial (descuenta del ranking)
    await History.findByIdAndDelete(logId);
    console.log("✅ [ANULAR] Venta eliminada del historial.");

    return res.status(200).json({ 
      success: true, 
      message: `Venta anulada. Se devolvieron las tallas al stock de ${updatedProduct.name}.` 
    });

  } catch (error) {
    console.error("❌ [ANULAR] Error:", error);
    return res.status(500).json({ error: "Error en el servidor al anular: " + error.message });
  }
});

export default router;