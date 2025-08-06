import express from 'express';
import PDFDocument from 'pdfkit';
import Product from '../models/Product.js'; // Asegúrate del path correcto

const router = express.Router();

router.get('/export-products-pdf', async (req, res) => {
  try {
    const products = await Product.find();

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');

    doc.pipe(res);

    doc.fontSize(20).text('Lista de Productos', { align: 'center' });
    doc.moveDown();

    products.forEach((product, index) => {
      doc.fontSize(12).text(`Producto ${index + 1}`);
      doc.text(`Nombre: ${product.name}`);
      doc.text(`Precio: ₡${product.price}`);
      doc.text(`Tipo: ${product.type}`);

      if (product.stock) {
        doc.text('Stock:');
        for (const [talla, cantidad] of Object.entries(product.stock)) {
          doc.text(`   - Talla ${talla}: ${cantidad}`);
        }
      }

      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error('Error exportando PDF:', error);
    res.status(500).json({ error: 'Error generando el PDF' });
  }
});

export default router;