import { useEffect, useRef, useState } from 'react';

const tallasAdulto = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
const tallasNino = ['16', '18', '20', '22', '24', '26', '28'];

export default function ProductModal({ product, onClose, onUpdate }) {
  const modalRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStock, setEditedStock] = useState({ ...product.stock });

  // Bloquear scroll del body cuando se muestra el modal
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch(`https://chemas-backend.onrender.com/api/products/${product._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: editedStock }),
      });

      if (!response.ok) throw new Error('Error al actualizar en el servidor');

      const updatedProduct = await response.json();
      onUpdate(updatedProduct);
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Hubo un problema al actualizar el stock');
    }
  };

  const tallasVisibles = product.type === 'Niño' ? tallasNino : tallasAdulto;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
      >
        <img src={product.imageSrc} alt={product.imageAlt} className="rounded-lg mb-4" />
        <h2 className="text-lg font-bold mb-2 text-center">{product.name}</h2>

        <div className="mb-4">
          <p className="text-center font-semibold mb-2">Stock por talla:</p>
          <div className="grid grid-cols-3 gap-2">
            {tallasVisibles.map((talla) => (
              <div key={talla} className="text-center border rounded p-2">
                <label className="block text-sm font-medium">{talla}</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded px-1 text-center"
                    value={editedStock[talla] || 0}
                    onChange={(e) =>
                      setEditedStock({ ...editedStock, [talla]: Number(e.target.value) })
                    }
                  />
                ) : (
                  <p className="text-sm">{editedStock[talla] || 0} disponibles</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
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
