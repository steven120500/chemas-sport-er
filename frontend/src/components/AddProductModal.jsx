import { useState, useRef, useEffect } from 'react';
import { tallaPorTipo } from '../utils/tallaPorTipo';
import { FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LoadingOverlay from './LoadingOverlay'; // Asegurate que exista y esté bien la ruta

export default function AddProductModal({ onAdd, onCancel }) {
  const [images, setImages] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('Player');
  const [stock, setStock] = useState({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  const acceptedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/heic'];

  const handleImageDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).slice(0, 2 - images.length);
    const validFiles = files.filter((file) => acceptedTypes.includes(file.type));

    if (validFiles.length === 0) {
      toast.error('Formato de imagen no soportado');
      return;
    }

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, { src: reader.result, file }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && acceptedTypes.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, { src: reader.result, file }].slice(0, 2));
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Formato de imagen no soportado');
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleStockChange = (size, value) => {
    setStock((prev) => ({ ...prev, [size]: parseInt(value) || 0 }));
  };

  const handleSubmit = async () => {
    if (!name || !price || images.length === 0) {
      toast.error('Todos los campos son obligatorios.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://chemas-sport-er-backend.onrender.com/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          price,
          type,
          stock,
          imageSrc: images[0]?.src,
          imageSrc2: images[1]?.src || null,
          imageAlt: name,
        }),
      });

      if (!response.ok) throw new Error('Fallo al guardar en el servidor');

      const { product } = await response.json();
      onAdd(product);

      toast.success('Producto agregado correctamente');

      setTimeout(() => {
        setLoading(false);
        onCancel();
      }, 1000);
    } catch (err) {
      console.error('Error al agregar el producto:', err);
      toast.error('Error al agregar el producto');
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const tallas = tallaPorTipo[type];

  return (
    <>
      {loading && <LoadingOverlay message="Agregando producto..." />}

      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-y-auto">
        <div
          ref={modalRef}
          className="bg-white rounded-lg max-w-md w-full shadow-lg h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
        >
          <div className="relative p-6">
            <button
              onClick={onCancel}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              <FaTimes />
            </button>

            {/* Imagenes */}
            <div
              onDrop={handleImageDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current.click()}
              className="border-2 border-dashed border-gray-300 p-4 rounded-md cursor-pointer text-center mb-4"
            >
              {images.length > 0 ? (
                <div className="flex gap-2 justify-center flex-wrap">
                  {images.map((img, index) => (
                    <div key={index} className="relative">
                      <img src={img.src} alt={`preview-${index}`} className="w-24 h-24 object-cover rounded" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute top-0 right-0 bg-black text-white text-xs rounded-full px-1"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">
                  Arrastra y suelta una imagen aquí (PNG, JPG, JPEG, HEIC) o haz clic para seleccionar
                </p>
              )}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.heic"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            <input
              type="text"
              placeholder="Nombre del producto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded mb-3"
            />

            <input
              type="text"
              placeholder="Precio (₡)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded mb-3"
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
            >
              {Object.keys(tallaPorTipo).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {tallas.map((size) => (
                <div key={size} className="text-center">
                  <label className="block mb-1 text-sm font-medium">{size}</label>
                  <input
                    type="number"
                    min="0"
                    value={stock[size] || 0}
                    onChange={(e) => handleStockChange(size, e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-center"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition"
              disabled={loading}
            >
              {loading ? 'Agregando...' : 'Agregar producto'}
            </button>
          </div>

          <ToastContainer position="bottom-center" autoClose={2000} />
        </div>
      </div>
    </>
  );
}
