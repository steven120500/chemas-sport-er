import { useState, useRef, useEffect } from 'react';
import { tallaPorTipo } from '../utils/tallaPorTipo';
import { FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AddProductModal({ onAdd, onCancel }) {
  const [image, setImage] = useState(null);
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
    const file = e.dataTransfer.files[0];
    if (file && acceptedTypes.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = () => setImage({ src: reader.result, file });
      reader.readAsDataURL(file);
    } else {
      toast.error('Formato de imagen no soportado');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && acceptedTypes.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = () => setImage({ src: reader.result, file });
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
    if (!name || !price || !image) {
      toast.error('Todos los campos son obligatorios.');
      return;
    }

    setLoading(true);

    try {
      await new Promise((res) => setTimeout(res, 1500));

      onAdd({
        name,
        price,
        type,
        stock,
        imageSrc: image.src,
      });

      toast.success('Producto agregado correctamente');
      setTimeout(() => {
        setLoading(false);
        onCancel();
      }, 1000);
    } catch (err) {
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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg max-w-md w-full shadow-lg max-h-[90vh] flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
        >
        <div className="relative p-6">
          <button
            onClick={onCancel}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          >
            <FaTimes />
          </button>

          {/* Imagen */}
          <div
            onDrop={handleImageDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current.click()}
            className="border-2 border-dashed border-gray-300 p-4 rounded-md cursor-pointer text-center mb-4"
          >
            {image ? (
              <div className="relative">
                <img src={image.src} alt="preview" className="w-full rounded-md" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImage(null);
                  }}
                  className="absolute top-1 right-1 bg-black text-white rounded-full p-1 text-xs"
                >
                  <FaTimes />
                </button>
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
  );
}
