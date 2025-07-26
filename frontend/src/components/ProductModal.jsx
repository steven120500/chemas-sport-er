import { useEffect, useRef, useState } from 'react';

export default function ProductModal({ product, onClose }) {
  const modalRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStock, setEditedStock] = useState({ ...product.stock });

  // Cierra el modal si se hace clic fuera de él
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Guarda los cambios en localStorage
  const handleSave = () => {
    const stored = localStorage.getItem('products');
    const products = stored ? JSON.parse(stored) : [];
    const updated = products.map((p) =>
      p.id === product.id ? { ...p, stock: editedStock } : p
    );
    localStorage.setItem('products', JSON.stringify(updated));
    setIsEditing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div ref={modalRef} className="bg-white p-6 rounded-lg shadow-md max-w-md w-full relative">
        <img src={product.imageSrc} alt={product.imageAlt} className="rounded-lg mb-4" />
        <h2 className="text-lg font-bold mb-2 text-center">{product.name}</h2>

        <div className="mb-4">
          <p className="text-center font-semibold mb-2">Selecciona tu talla:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(editedStock).map(([talla, cantidad]) => (
              <div key={talla} className="px-4 py-2 border rounded">
                {isEditing ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium">{talla}</span>
                    <input
                      type="number"
                      min="0"
                      className="w-16 border border-gray-300 rounded px-1 text-center"
                      value={cantidad}
                      onChange={(e) =>
                        setEditedStock({ ...editedStock, [talla]: Number(e.target.value) })
                      }
                    />
                  </div>
                ) : (
                  <span>
                    {talla} ({cantidad} disponibles)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
            onClick={onClose}
          >
            Cerrar
          </button>

          {isEditing ? (
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              onClick={handleSave}
            >
              Guardar
            </button>
          ) : (
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              onClick={() => setIsEditing(true)}
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
