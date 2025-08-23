import { Toaster } from 'react-hot-toast';
import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import AddProductModal from './components/AddProductModal';
import LoginModal from './components/LoginModal';
import RegisterUserModal from './components/RegisterUserModal';
import Footer from './components/Footer';
import FloatingWhatsapp from './components/FloatingWhatsapp';
import LoadingOverlay from './components/LoadingOverlay';
import tallaPorTipo from './utils/tallaPorTipo';
import { FaPlus } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import TopBanner from './components/TopBanner';
import UserListModal from './components/UserListModal';
import HistoryModal from './components/HistoryModal';

// Toma la URL del backend desde .env (sin barra final). Si no existe, usa Render:
const API_BASE =
  (import.meta.env.VITE_API_URL?.replace(/\/+$/, '')) ||
  'https://chemas-sport-er-backend.onrender.com';

// helper páginas: 1 … (p-2)(p-1)[p](p+1)(p+2) … last
function buildPages(page, pages) {
  const out = new Set([1, pages, page, page - 1, page - 2, page + 1, page + 2]);
  return [...out].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
}

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterUserModal, setShowRegisterUserModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / limit));

  const anyModalOpen =
    !!selectedProduct ||
    showAddModal ||
    showLogin ||
    showRegisterUserModal ||
    showUserListModal ||
    showHistoryModal;

  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const isSuperUser = !!user?.isSuperUser;
  const canSeeHistory = isSuperUser || user?.roles?.includes('history');
  const canAdd = isSuperUser || user?.roles?.includes('add');
  const canEdit = isSuperUser || user?.roles?.includes('edit');
  const canDelete = isSuperUser || user?.roles?.includes('delete');

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast.success('Sesión cerrada correctamente');
  };

  // Cargar productos
  const fetchProducts = async (opts = {}) => {
    const p = opts.page ?? page;
    const q = (opts.q ?? searchTerm).trim();
    const tp = (opts.type ?? filterType).trim();

    setLoading(true);
    const controller = new AbortController();

    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(q ? { q } : {}),
        ...(tp ? { type: tp } : {}),
      });

      const url = `${API_BASE}/api/products?${params.toString()}`;
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        toast.error(`Error al cargar (HTTP ${res.status})`);
        throw new Error('HTTP ' + res.status);
      }

      const json = await res.json();
      setProducts(Array.isArray(json.items) ? json.items : []);
      setTotal(Number(json.total || 0));
      setPage(Number(json.page || p));
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('fetchProducts error:', e);
        setProducts([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  };

  useEffect(() => {
    const cancel = fetchProducts({ page, q: searchTerm, type: filterType });
    return () => typeof cancel === 'function' && cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searchTerm, filterType, API_BASE]);

  // Sincroniza modal y lista cuando se edita/borra
  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts(prev => prev.filter(p => String(p._id) !== String(deletedId)));
      setSelectedProduct(null);
      toast.success('Producto eliminado correctamente');
      return;
    }
    setProducts(prev =>
      prev.map(p => (String(p._id) === String(updatedProduct._id) ? updatedProduct : p))
    );
    setSelectedProduct(updatedProduct);
    toast.success('Producto actualizado correctamente');
  };

  const handleLoginClick = () => setShowLogin(true);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setShowLogin(false);
    toast.success('Bienvenido'); // <-- antes faltaban comillas
  };

  const handleRegisterClick = () => {
    setTimeout(() => setShowRegisterUserModal(true), 100);
  };

  const filteredProducts = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return products.filter(p => {
      const matchName = (p.name || '').toLowerCase().includes(s);
      const matchType = filterType ? p.type === filterType : true;
      return matchName && matchType;
    });
  }, [products, searchTerm, filterType]);

  return (
    <>
      {showRegisterUserModal && (
        <RegisterUserModal onClose={() => setShowRegisterUserModal(false)} />
      )}

      {showUserListModal && (
        <UserListModal
          open={showUserListModal}
          onClose={() => setShowUserListModal(false)}
        />
      )}

      {showHistoryModal && (
        <HistoryModal
          open={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          isSuperUser={isSuperUser}
          roles={user?.roles || []}
        />
      )}

      <TopBanner />

      {loading && <LoadingOverlay message="Cargando productos..." />}

      {!anyModalOpen && (
        <Header
          onLoginClick={handleLoginClick}
          onLogout={handleLogout}
          user={user}
          isSuperUser={isSuperUser}
          setShowRegisterUserModal={setShowRegisterUserModal}
          setShowUserListModal={setShowUserListModal}
          setShowHistoryModal={setShowHistoryModal}
          canSeeHistory={canSeeHistory}
        />
      )}

      {canAdd && !anyModalOpen && (
        <button
          className="fixed bottom-6 right-6 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition z-50"
          onClick={() => setShowAddModal(true)}
          title="Añadir producto"
        >
          <FaPlus />
        </button>
      )}

      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterType={filterType}
        setFilterType={setFilterType}
      />

      <div className="px-4 grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onClick={() => setSelectedProduct(product)}
          />
        ))}
      </div>

      {selectedProduct && (
        <ProductModal
          key={`${selectedProduct._id}-${selectedProduct.updatedAt || ''}`}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUpdate={handleProductUpdate}
          canEdit={canEdit}
          canDelete={canDelete}
          user={user}
        />
      )}

      {showAddModal && (
        <AddProductModal
          user={user}
          tallaPorTipo={tallaPorTipo}
          onAdd={(newProduct) => {
            setProducts(prev => [newProduct, ...prev]);
            setShowAddModal(false);
            toast.success('Producto agregado correctamente');
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {showLogin && (
        <LoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onLoginSuccess={handleLoginSuccess}
          onRegisterClick={handleRegisterClick}
        />
      )}

      {/* Paginación */}
      {pages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <nav className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-1 rounded border disabled:opacity-50"
              title="Primera"
            >
              «
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border disabled:opacity-50"
              title="Anterior"
            >
              Anterior
            </button>

            {(() => {
              const nums = buildPages(page, pages);
              return nums.map((n, i) => {
                const prev = nums[i - 1];
                const showDots = i > 0 && n - prev > 1;
                return (
                  <span key={n} className="flex">
                    {showDots && <span className="px-2">…</span>}
                    <button
                      onClick={() => setPage(n)}
                      className={`px-3 py-1 rounded border ${
                        n === page ? 'bg-black text-white' : 'hover:bg-gray-100'
                      }`}
                    >
                      {n}
                    </button>
                  </span>
                );
              });
            })()}

            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-3 py-1 rounded border disabled:opacity-50"
              title="Siguiente"
            >
              Siguiente
            </button>
            <button
              onClick={() => setPage(pages)}
              disabled={page === pages}
              className="px-3 py-1 rounded border disabled:opacity-50"
              title="Última"
            >
              »
            </button>
          </nav>
        </div>
      )}

      <Footer />
      {!anyModalOpen && <FloatingWhatsapp />}
      <ToastContainer />
      <Toaster position="top-center" reverseOrder={false} />
    </>
  );
}

export default App;