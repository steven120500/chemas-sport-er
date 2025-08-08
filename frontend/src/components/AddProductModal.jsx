// src/components/AddProductModal.jsx
import { useState, useRef, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import tallaPorTipo from '../utils/tallaPorTipo';

// ==== Config ====
const MAX_IMAGES = 2;
const MAX_WIDTH = 1200;     // reescala si es más ancho
const QUALITY = 0.8;        // calidad WebP
// ~900 KB por imagen en base64 (ajústalo si tu backend lo permite)
const MAX_IMAGE_BASE64_LEN = 2_800_000;

// ==== Helpers ====
// Convierte File -> dataURL WebP (reescala si hace falta)
async function convertToWebp(file, { maxWidth = MAX_WIDTH, quality = QUALITY } = {}) {
  // File -> dataURL (lee la imagen)
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  // Crea imagen
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Formato de imagen no soportado'));
    i.src = dataUrl;
  });

  // Canvas + posible reescalado
  const canvas = document.createElement('canvas');
  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Genera WebP (si el navegador no soporta webp, caerá en png)
  const out = canvas.toDataURL('image/webp', quality);

  // Valida tamaño (longitud del string base64)
  if (out.length > MAX_IMAGE_BASE64_LEN) {
    throw new Error(
      `La imagen sigue muy pesada tras convertir (${Math.round(out.length / 5000)} KB).`
    );
  }
  return out;
}

export default function AddProductModal({ onAdd, onCancel }) {
  const [images, setImages] = useState([]); // [{src}]
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('Player');
  const [stock, setStock] = useState({});
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const tallas = tallaPorTipo[type];

  // ---- Imagenes ----
  const handleFiles = async (filesLike) => {
    const files = Array.from(filesLike).slice(0, MAX_IMAGES - images.length);
    if (files.length === 0) return;

    try {
      setLoading(true);
      const converted = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          toast.error('Formato de imagen no soportado');
          continue;
        }
        const webpDataUrl = await convertToWebp(file);
        converted.push({ src: webpDataUrl });
      }
      if (converted.length) {
        setImages(prev => [...prev, ...converted].slice(0, MAX_IMAGES));
        toast.success('Imágenes optimizadas a WebP');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'No se pudo optimizar la imagen');
    } finally {
      setLoading(false);
    }
  };

  const handleImageDrop = async (e) => {
    e.preventDefault();
    if (!e.dataTransfer?.files?.length) return;
    await handleFiles(e.dataTransfer.files);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFiles([file]);
    // permite volver a elegir el mismo archivo
    e.target.value = '';
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStockChange = (size, value) => {
    setStock(prev => ({ ...prev, [size]: parseInt(value) || 0 }));
  };

  // ---- Submit (una sola vez) ----
  const handleSubmit = async () => {
    if (loading) return; // guard
    if (!name.trim() || !price || images.length === 0) {
      toast.error('Todos los campos e imagen (mínimo 1) son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://chemas-sport-er-backend.onrender.com/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price,
          type,
          stock,
          imageSrc: images[0]?.src || null,
          imageSrc2: images[1]?.src || null,
          imageAlt: name.trim(),
        }),
      });

      if (!response.ok) throw new Error('Falló al guardar en el servidor');

      const data = await response.json();
      onAdd?.(data.product); // ← solo el objeto del producto
      

      // limpiar/cerrar
      setImages([]); setName(''); setPrice(''); setType('Player'); setStock({});
      onCancel?.();
    } catch (err) {
      console.error('Error al agregar el producto:', err);
      toast.error(err.message || 'Error al agregar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-y-auto"
    >
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg overflow-y-auto scrollbar-thin">
        <div className="relative p-6">
          <button onClick={onCancel} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800">
            <FaTimes />
          </button>

          <h2 className="text-lg font-semibold mb-4">Agregar producto</h2>

          {/* Zona de imágenes */}
          <div
            onDrop={handleImageDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 p-4 rounded text-center mb-4"
          >
            <p className="text-gray-500 mb-2">
              Arrastra y suelta hasta {MAX_IMAGES} imagen(es) o haz clic para seleccionar (se convertirán a WebP)
            </p>

            <div className="flex gap-2 justify-center flex-wrap mb-3">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img.src} alt={`preview-${i}`} className="w-24 h-24 object-cover rounded" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(i); }}
                    className="absolute -top-1 -right-1 bg-black text-white text-xs rounded-full px-1"
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>

            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 p-2 rounded w-full text-center"
              >
                Seleccionar imagen
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Nombre */}
          <input
            type="text"
            placeholder="Nombre del producto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded mb-3"
          />

          {/* Precio */}
          <input
            type="text"
            placeholder="Precio (₡)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded mb-3"
          />

          {/* Tipo */}
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
          >
            {Object.keys(tallaPorTipo).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Stock por talla */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {tallas.map((size) => (
              <label key={size} className="text-center">
                <span className="block mb-1 text-sm font-medium">{size}</span>
                <input
                  type="number"
                  min="0"
                  value={stock[size] ?? 0}
                  onChange={(e) => handleStockChange(size, e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-center"
                />
              </label>
            ))}
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-black text-white py-2 rounded hover:bg-gray-800 transition disabled:opacity-60"
            >
              {loading ? 'Agregando…' : 'Agregar producto'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}