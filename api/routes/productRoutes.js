// routes/productRoutes.js
import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json({ message: 'Producto guardado', product: newProduct });
  } catch (err) {
    console.error('Error al guardar producto:', err);
    res.status(500).json({ message: 'Error al guardar producto' });
  }
});


// Obtener todos
router.get('/', async (_req, res) => {
    try {
      const products = await Product.find().sort({ createdAt: -1 });
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener los productos' });
    }
  });

  // Actualizar producto
router.put('/:id', async (req, res) => {
    try {
      const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      res.json(updated);
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      res.status(500).json({ message: 'Error al actualizar producto' });
    }
  });

  // Eliminar producto
router.delete('/:id', async (req, res) => {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      res.json({ message: 'Producto eliminado con éxito' });
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      res.status(500).json({ message: 'Error al eliminar producto' });
    }
  });
  
  

export default router;
