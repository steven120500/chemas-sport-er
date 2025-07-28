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




export default function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('products');
    const parsed = stored ? JSON.parse(stored) : [];

    if (parsed && parsed.length > 0) {
      setProducts(parsed);
    } else {
      const mockProducts = [
        {
          id: 1,
          name: 'CR7 2008 Manchester United',
          price: '₡20000',
          imageSrc: 'https://chemastorecr.myshopify.com/cdn/shop/files/4598837F-987F-4905-AAF7-F2508C501747.jpg?v=1737214808&width=823',
          imageAlt: 'CR7 2008 Manchester United.',
          type: 'Retro',
          stock: { S: 5, M: 3, L: 4 },
        },
        {
          id: 2,
          name: 'Neymar Brasil',
          price: '₡20000',
          imageSrc: 'https://chemastorecr.myshopify.com/cdn/shop/files/B6EFA54C-0FF6-4B96-8096-C5FC90E3814A.jpg?v=1738704926&width=823',
          imageAlt: 'Neymar Brasil',
          type: 'Player',
          stock: { S: 5, M: 3, L: 4 },
        },
        {
          id: 3,
          name: 'CR7 All Nassr',
          price: '₡20000',
          imageSrc: 'https://chemastorecr.myshopify.com/cdn/shop/files/18992C07-A4B6-4E6F-8492-3F5330AC4FF2.jpg?v=1738018760&width=823',
          imageAlt: 'CR7 All Nassr',
          type: 'Niño',
          stock: { 20: 3 },
        },
        {
          id: 4,
          name: 'Lisa Barcelona',
          price: '₡20000',
          imageSrc: 'https://chemastorecr.myshopify.com/cdn/shop/files/9A0EBE8B-A2BC-46A4-B820-6933209DD143.jpg?v=1750966766&width=360',
          imageAlt: 'Lisa Barcelona',
          type: 'Mujer',
          stock: { S: 5, M: 3, L: 4 },
        },
      ];
      setProducts(mockProducts);
      localStorage.setItem('products', JSON.stringify(mockProducts));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  const filteredProducts = products.filter((product) => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType ? product.type === filterType : true;

    return matchName && matchType;
  });

  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <Header />

      {/* FAB Botón Añadir */}
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
          <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
        ))}
      </div>

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {showAddModal && (
        <AddProductModal
          tallaPorTipo={tallaPorTipo}
          onAdd={(product) => {
            setProducts([...products, { ...product, id: Date.now(), imageAlt: product.name }]);
            setShowAddModal(false);
            toast.success('Producto agregado exitosamente');
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      <Footer />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}
