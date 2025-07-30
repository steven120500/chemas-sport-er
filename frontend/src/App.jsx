import { useEffect, useState } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import AddProductModal from './components/AddProductModal';
import Footer from './components/Footer';
import tallaPorTipo from './utils/tallaPorTipo';
import { FaPlus } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import FloatingWhatsapp from './components/FloatingWhatsapp';
import LoadingOverlay from './components/LoadingOverlay';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await fetch('https://chemas-sport-er-backend.onrender.com/api/products');
      if (!res.ok) throw new Error('No se pudo obtener los productos');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      toast.error('No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts((prev) => prev.filter((p) => p._id !== deletedId));
      setSelectedProduct(null);
      toast.success('Producto eliminado correctamente');
    } else {
      setProducts((prev) =>
        prev.map((p) => (p._id === updatedProduct._id ? updatedProduct : p))
      );
      toast.success('Producto actualizado correctamente');
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType ? product.type === filterType : true;
    return matchName && matchType;
  });

  return (
    <>
      {loading && <LoadingOverlay message="Cargando productos..." />}

      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <Header />

        {/* Botón Añadir */}
        <button
          className="fixed bottom-6 right-6 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition z-50"
          onClick={() => setShowAddModal(true)}
          title="Añadir producto"
        >
          <FaPlus />
        </button>

        <FilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
        />

        <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8">
          {filteredProducts.map((product) => (
            <ProductCard key={product._id} product={product} onClick={() => setSelectedProduct(product)} />
          ))}
        </div>

        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onUpdate={handleProductUpdate}
          />
        )}

        {showAddModal && (
          <AddProductModal
            tallaPorTipo={tallaPorTipo}
            onAdd={(newProduct) => {
              setProducts((prev) => [...prev, newProduct]);
              setShowAddModal(false);
              toast.success('Producto agregado correctamente');
            }}
            onCancel={() => setShowAddModal(false)}
          />
        )}

        <FloatingWhatsapp />
        <Footer />
      </div>

      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        limit={1}
      />
    </>
  );
}