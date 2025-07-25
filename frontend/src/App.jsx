import { useEffect, useState } from 'react';

const tallaPorTipo = {
  Player: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  Fan: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  Mujer: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  Nacional: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  Abrigos: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  Retro: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  Niño: ['16', '18', '20', '22', '24', '26', '28'],
};

export default function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    imageSrc: '',
    type: '',
    stock: {},
  });

  // Cargar desde localStorage
  useEffect(() => {
    const stored = localStorage.getItem('products');
    if (stored) {
      setProducts(JSON.parse(stored));
    } else {
      setProducts([
        {
          id: 1,
          name: 'CR7 2008 Manchester United',
          price: '₡20000',
          imageSrc: 'https://i.pinimg.com/736x/fa/b1/e2/fab1e2eee915b1b1ee7c9ade32380040.jpg',
          imageAlt: 'CR7 2008 Manchester United.',
          type: 'Player',
          stock: { S: 5, M: 3, L: 4 },
        },
      ]);
    }
  }, []);

  // Guardar en localStorage
  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  const filteredProducts = products.filter((product) => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType ? product.type === filterType : true;
    return matchName && matchType;
  });

  const handleAddProduct = () => {
    const { name, price, imageSrc, type } = newProduct;
    if (!name || !price || !imageSrc || !type) {
      alert('Completa todos los campos');
      return;
    }

    const newItem = {
      ...newProduct,
      id: Date.now(),
      imageAlt: name,
    };

    setProducts([...products, newItem]);
    setNewProduct({ name: '', price: '', imageSrc: '', type: '', stock: {} });
    setShowAddModal(false);
  };

  return (
    <div className="bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center w-full">
            Chemas Sport ER
          </h2>
          <button
            className="absolute right-6 top-6 bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
            onClick={() => setShowAddModal(true)}
          >
            Añadir inventario
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <input
            type="text"
            placeholder="Buscar por nombre o equipo"
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex flex-wrap justify-center gap-2 overflow-x-auto w-full px-2">
            {['Todos', 'Player', 'Fan', 'Mujer', 'Nacional', 'Abrigos', 'Retro', 'Niño'].map((label) => (
              <button
                key={label}
                className={`px-4 py-2 rounded-md transition whitespace-nowrap ${
                  filterType === label || (label === 'Todos' && filterType === '')
                    ? 'bg-gray-800 text-white'
                    : 'bg-black text-white'
                }`}
                onClick={() => setFilterType(label === 'Todos' ? '' : label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Productos */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8 min-w-[600px] sm:min-w-full">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="text-center cursor-pointer hover:shadow-lg transition"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={product.imageSrc}
                    alt={product.imageAlt}
                    className="h-full w-full object-cover object-center transition duration-300 hover:opacity-75"
                  />
                </div>
                <h3 className="mt-4 text-sm text-gray-700 font-medium">{product.name}</h3>
                <p className="mt-1 text-sm text-gray-900">{product.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal producto */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center px-2">
          <div className="bg-white p-6 rounded-lg max-w-md w-full text-center shadow-xl overflow-y-auto max-h-screen">
            <h2 className="text-xl font-bold mb-4">{selectedProduct.name}</h2>
            <img
              src={selectedProduct.imageSrc}
              alt={selectedProduct.imageAlt}
              className="w-full rounded mb-4"
            />
            <p className="text-gray-700 mb-2">Selecciona tu talla:</p>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {Object.entries(selectedProduct.stock || {}).map(([size, qty]) => (
                <button
                  key={size}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 transition"
                >
                  {size} ({qty} disponibles)
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
              className="mt-3 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal añadir producto */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center px-4">
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-xl overflow-y-auto max-h-screen">
            <h2 className="text-xl font-bold mb-4 text-center">Añadir Camiseta</h2>

            <input
              type="text"
              placeholder="Nombre"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded"
            />
            <input
              type="text"
              placeholder="Precio (₡20000)"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded"
            />
            <input
              type="text"
              placeholder="URL imagen"
              value={newProduct.imageSrc}
              onChange={(e) => setNewProduct({ ...newProduct, imageSrc: e.target.value })}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded"
            />
            <select
              value={newProduct.type}
              onChange={(e) => {
                const selected = e.target.value;
                const sizes = tallaPorTipo[selected] || [];
                const initialStock = {};
                sizes.forEach((t) => (initialStock[t] = 0));
                setNewProduct({ ...newProduct, type: selected, stock: initialStock });
              }}
              className="w-full mb-4 px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">Seleccionar tipo</option>
              {Object.keys(tallaPorTipo).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Tallas dinámicas */}
            {newProduct.type && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {tallaPorTipo[newProduct.type].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <label className="w-10">{t}</label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.stock?.[t] || 0}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          stock: {
                            ...newProduct.stock,
                            [t]: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="flex-1 px-2 py-1 border rounded"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddProduct}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
