import { Toaster } from 'react-hot-toast';
import React, { useEffect, useRef, useState } from 'react';
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
import UserDropdown from './components/UserDropDown';
import UserListModal from './components/UserListModal';
import HistoryModal from './components/HistoryModal';
import Medidas from './components/Medidas';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

// helper para páginas
function buildPages(page, pages) {
  const out = new Set([1, pages, page, page - 1, page - 2, page + 1, page + 2]);
  return [...out]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
}

// Normaliza id
const getPid = (p) => String(p?._id ?? p?.id ?? '');

function App() {
  // --- estados de productos ---
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // --- filtros ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSizes, setFilterSizes] = useState([]); // varias tallas

  // --- modales ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterUserModal, setShowRegisterUserModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMedidas, setShowMedidas] = useState(false);

  // --- paginación ---
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / limit));

  // --- control modal abierto ---
  const anyModalOpen =
    !!selectedProduct ||
    showAddModal ||
    showLogin ||
    showRegisterUserModal ||
    showUserListModal ||
    showHistoryModal ||
    showMedidas;

  // --- usuario ---
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Error parsing user from localStorage', error);
      return null;
    }
  });

  const isSuperUser = user?.isSuperUser || false;
  const canSeeHistory = user?.isSuperUser || user?.roles?.includes('history');
  const canClearHistory = user?.isSuperUser;
  const canAdd = user?.isSuperUser || user?.roles?.includes('add');
  const canEdit = user?.isSuperUser || user?.roles?.includes('edit');
  const canDelete = user?.isSuperUser || user?.roles?.includes('delete');

  // logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast.success('Sesión cerrada correctamente');
  };

  // fetch productos
  const fetchProducts = async (opts = {}) => {
    const p = opts.page ?? page;
    const q = (opts.q ?? searchTerm).trim();
    const tp = (opts.type ?? filterType).trim();

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(q ? { q } : {}),
        ...(tp ? { type: tp } : {}),
        ...(filterSizes.length ? { sizes: filterSizes.join(',') } : {}),
      });

      const res = await fetch(`${API_BASE}/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const json = await res.json();
      setProducts(json.items);
      setTotal(json.total);
      setPage(json.page);
    } catch (e) {
      console.error('fetchProducts error:', e);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // scroll al top
  const pageTopRef = useRef(null);
  useEffect(() => {
    fetchProducts({ page, q: searchTerm, type: filterType });
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searchTerm, filterType, filterSizes]);

  // update producto
  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts((prev) => prev.filter((p) => getPid(p) !== String(deletedId)));
      setSelectedProduct(null);
      toast.success('Producto eliminado correctamente');
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        getPid(p) === getPid(updatedProduct) ? { ...p, ...updatedProduct } : p
      )
    );

    setSelectedProduct((prev) =>
      prev && getPid(prev) === getPid(updatedProduct)
        ? { ...prev, ...updatedProduct }
        : prev
    );

    toast.success('Producto actualizado correctamente');
  };

  // login
  const handleLoginClick = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    toast.success('Bienvenido');
  };

  const handleRegisterClick = () => {
    setTimeout(() => {
      setShowRegisterUserModal(true);
    }, 100);
  };

  // filtro
  const allSizes = [
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    '3XL',
    '4XL',
    '16',
    '18',
    '20',
    '22',
    '24',
    '26',
    '28',
  ];

  const filteredProducts = products.filter((product) => {
    const matchName = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchType = filterType ? product.type === filterType : true;

    if (filterSizes.length === allSizes.length) {
      return matchName && matchType;
    }

    const matchSizes =
      filterSizes.length > 0
        ? filterSizes.some((size) =>
            Object.entries(product.stock || {}).some(
              ([s, qty]) =>
                s.toLowerCase() === size.toLowerCase() && Number(qty) > 0
            )
          )
        : true;

    return matchName && matchType && matchSizes;
  });

  // tallas
  const tallasAdulto = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
  const tallasNino = ['16', '18', '20', '22', '24', '26', '28'];

  // render
  return (
    <>
      <div ref={pageTopRef} />

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
          isSuperUser={user?.isSuperUser === true}
          roles={user?.roles || []}
        />
      )}

      {showMedidas && (
        <Medidas
          open={showMedidas}
          onClose={() => setShowMedidas(false)}
          currentType={filterType || 'Todos'}
        />
      )}

      <TopBanner />

      {loading && <LoadingOverlay message="Cargando productos..." />}

      {!anyModalOpen && (
        <Header
          onLoginClick={handleLoginClick}
          onLogout={handleLogout}
          onLogoClick={() => {
            setFilterType('');
            setSearchTerm('');
            setPage(1);
          }}
          user={user}
          isSuperUser={user?.isSuperUser}
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
        setFilterType={(t) => {
          setFilterType(t);
          setPage(1);
        }}
      />

      {/* Filtro por tallas */}
      <div className="px-4 mt-2 mb-4 flex flex-wrap gap-2 justify-center">
        {[...tallasAdulto, ...tallasNino].map((size) => {
          const isActive = filterSizes.includes(size);
          return (
            <button
              key={size}
              onClick={() => {
                setFilterSizes((prev) =>
                  isActive
                    ? prev.filter((s) => s !== size)
                    : [...prev, size]
                );
              }}
              className={`px-3 py-1 rounded-md border ${
                isActive
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-gray-400 hover:bg-gray-200'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>

      {/* Pregunta + botón Medidas */}
      <div className="px-4 mt-2 mb-4 flex items-center justify-center gap-3">
        <span className="text-sm sm:text-base text-gray-700">
          ¿Querés saber tu talla?
        </span>
        <button
          onClick={() => setShowMedidas(true)}
          className="bg-black text-white px-2 py-1 rounded hover:bg-gray-800 font-semibold tracking-tight"
          title="Ver medidas"
        >
          Medidas
        </button>
      </div>

      {/* Productos */}
      <div className="px-4 grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <ProductCard
              key={getPid(product)}
              product={product}
              onClick={() => setSelectedProduct(product)}
              user={user}
            />
          ))
        ) : (
          <div className="col-span-full text-center text-gray-600 font-semibold py-10 bg-gray-100 rounded-md">
            {filterSizes.length > 0
              ? `No tenemos disponibles en talla ${filterSizes.join(
                  ', '
                )} por ahora, ¡pero pronto tendremos más!`
              : 'No tenemos productos disponibles en este momento, ¡pero pronto tendremos más!'}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          key={`${getPid(selectedProduct)}-${selectedProduct.updatedAt || ''}`}
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
            setProducts((prev) => [newProduct, ...prev]);
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
          onLoginSuccess={(userData) => {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            setShowLogin(false);
            toast.success('Bienvenido');
          }}
          onRegisterClick={handleRegisterClick}
        />
      )}

      {showRegisterUserModal && (
        <RegisterUserModal onClose={() => setShowRegisterUserModal(false)} />
      )}

      {canSeeHistory && (
        <button
          onClick={() => setShowHistoryModal(true)}
          style={{ display: 'none' }}
        />
      )}

      {/* Paginación */}
      {pages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <nav className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-sm text-white bg-black rounded border disabled:opacity-50"
              title="Anterior"
            >
              <FaChevronLeft />
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
                      className={`px-2 text-sm py-0.5 rounded border ${
                        n === page
                          ? 'bg-black text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {n}
                    </button>
                  </span>
                );
              });
            })()}

            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-2 py-1 text-sm text-white bg-black rounded border disabled:opacity-50"
              title="Siguiente"
            >
              <FaChevronRight />
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
