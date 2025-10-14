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
import Cantidad from './components/Cantidad'; // ✅ añadido

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
  const [allProductsForCounts, setAllProductsForCounts] = useState([]); // ✅ añadido
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // --- filtros ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSizes, setFilterSizes] = useState([]);
  const [showSizes, setShowSizes] = useState(false);

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
  const canAdd = user?.isSuperUser || user?.roles?.includes('add');
  const canEdit = user?.isSuperUser || user?.roles?.includes('edit');
  const canDelete = user?.isSuperUser || user?.roles?.includes('delete');

  // logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast.success('Sesión cerrada correctamente');
  };

  // fetch productos paginados (vista actual)
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

  // ✅ obtiene absolutamente todos los productos (para Cantidad)
  const fetchAllForCounts = async () => {
    try {
      let pageN = 1;
      const pageSize = 200;
      const acc = [];
  
      while (true) {
        const params = new URLSearchParams({
          page: String(pageN),
          limit: String(pageSize),
          t:Date.now().toString(),
        });
  
        const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
  
        acc.push(...json.items);
        if (acc.length >= json.total) break;
        pageN += 1;
        await new Promise((r) => setTimeout(r,100));
      }
  
      setAllProductsForCounts(acc);
    } catch (e) {
      console.error("fetchAllForCounts error:", e);
      setAllProductsForCounts([]);
    }
  };
  

  // scroll al top y fetch de productos
  const pageTopRef = useRef(null);
  useEffect(() => {
    fetchProducts({ page, q: searchTerm, type: filterType });
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, limit, searchTerm, filterType, filterSizes]);

  // ✅ cargar todos los productos para Cantidad
  useEffect(() => {
    if(products.length > 0){
    fetchAllForCounts();
    }
  }, [products]);

  // ✅ refrescar totales
  const refreshCounts = () => {
    setTimeout(()=>{
    fetchAllForCounts();
    }, 600);
  };

  // update producto
  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts((prev) => prev.filter((p) => getPid(p) !== String(deletedId)));
      setSelectedProduct(null);
      toast.success('Producto eliminado correctamente');
      refreshCounts();
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
    refreshCounts();
  };

  // login
  const handleLoginClick = () => setShowLogin(true);
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    toast.success('Bienvenido');
  };
  const handleRegisterClick = () => setTimeout(() => setShowRegisterUserModal(true), 100);

  // filtro tallas
  const allSizes = ['S','M','L','XL','XXL','3XL','4XL','16','18','20','22','24','26','28'];

  // ✅ Filtro actualizado para Ofertas
  const filteredProducts = products.filter((product) => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());

    // 🆕 Filtro especial para ofertas (si tiene discountPrice > 0)
    if (filterType === 'Ofertas') {
      return (
        product.discountPrice !== undefined &&
        product.discountPrice !== null &&
        Number(product.discountPrice) > 0 &&
        matchName
      );
    }

    // Filtro por tipo normal
    const matchType = filterType ? product.type === filterType : true;

    if (filterSizes.length === allSizes.length) return matchName && matchType;

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

  const tallasAdulto = ['S','M','L','XL','XXL','3XL','4XL'];
  const tallasNino = [
    { size:'16', label:'16 (Talla 2)' },
    { size:'18', label:'18 (Talla 4)' },
    { size:'20', label:'20 (Talla 6)' },
    { size:'22', label:'22 (Talla 8)' },
    { size:'24', label:'24 (Talla 10)' },
    { size:'26', label:'26 (Talla 12)' },
    { size:'28', label:'28 (Talla 14/16)' },
  ];

  return (
    <>
      <div ref={pageTopRef} />

      {/* Modales */}
      {showRegisterUserModal && <RegisterUserModal onClose={() => setShowRegisterUserModal(false)} />}
      {showUserListModal && <UserListModal open={showUserListModal} onClose={() => setShowUserListModal(false)} />}
      {showHistoryModal && <HistoryModal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} isSuperUser={user?.isSuperUser === true} roles={user?.roles || []} />}
      {showMedidas && <Medidas open={showMedidas} onClose={() => setShowMedidas(false)} currentType={filterType || 'Todos'} />}

      <TopBanner />
      {loading && <LoadingOverlay message="Cargando productos..." />}

      {!loading && allProductsForCounts?.length > 0 && (
        <Cantidad products={allProductsForCounts} isSuperUser={isSuperUser} />
      )}

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

      {/* Barra filtros */}
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterType={filterType}
        setFilterType={(t) => { setFilterType(t); setPage(1); }}
        onToggleTallas={() => setShowSizes(!showSizes)}
      />

      {/* Botones tallas */}
      {showSizes && (
        <div className="px-4 mt-2 mb-4 flex flex-col gap-6 items-center">
          <div className="w-full text-center">
            <h3 className="font-semibold text-white-800 mb-2">Adulto</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {tallasAdulto.map((size) => {
                const isActive = filterSizes.includes(size);
                return (
                  <button
                    key={size}
                    onClick={() =>
                      setFilterSizes((prev) =>
                        isActive ? prev.filter((s) => s !== size) : [...prev, size]
                      )
                    }
                    className={`px-3 py-1 rounded-md border ${
                      isActive ? 'bg-purple-600 text-white border-black' : 'bg-yellow-600 text-black border-black-400 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full text-center">
            <h3 className="font-semibold text-white-800 mb-2">Niño (Talla de Costa Rica)</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {tallasNino.map(({ size, label }) => {
                const isActive = filterSizes.includes(size);
                return (
                  <button
                    key={size}
                    onClick={() =>
                      setFilterSizes((prev) =>
                        isActive ? prev.filter((s) => s !== size) : [...prev, size]
                      )
                    }
                    className={`px-3 py-1 rounded-md border ${
                      isActive ? 'bg-purple-600 text-white border-black' : 'bg-yellow-600 text-black border-black-400 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mt-2 mb-4 flex items-center justify-center gap-3">
        <span className="text-sm sm:text-base text-white">¿Querés saber tu talla?</span>
        <button onClick={() => setShowMedidas(true)} className="bg-yellow-600 text-white px-2 py-1 rounded hover:bg-gray-800 font-semibold tracking-tight" title="Ver medidas">
          Medidas
        </button>
      </div>

      {/* Productos */}
      <div className="px-4 grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <ProductCard key={getPid(product)} product={product} onClick={() => setSelectedProduct(product)} user={user} />
          ))
        ) : (
          <div className="col-span-full text-center text-gray-600 font-semibold py-10 bg-gray-100 rounded-md">
            {filterSizes.length > 0
              ? `No tenemos disponibles en talla ${filterSizes.join(', ')} por ahora, ¡pero pronto tendremos más!`
              : 'No tenemos productos disponibles en este momento, ¡pero pronto tendremos más!'}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal key={`${getPid(selectedProduct)}-${selectedProduct.updatedAt || ''}`} product={selectedProduct} onClose={() => setSelectedProduct(null)} onUpdate={handleProductUpdate} canEdit={canEdit} canDelete={canDelete} user={user} />
      )}

      {showAddModal && (
        <AddProductModal user={user} tallaPorTipo={tallaPorTipo}
          onAdd={(newProduct) => {
            setProducts((prev) => [newProduct, ...prev]);
            setShowAddModal(false);
            toast.success('Producto agregado correctamente');
            refreshCounts();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {showLogin && (
        <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} onLoginSuccess={(userData) => {
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          setShowLogin(false);
          toast.success('Bienvenido');
        }} onRegisterClick={handleRegisterClick} />
      )}

      {pages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <nav className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-sm text-white bg-purple-600 rounded border disabled:opacity-50"
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
                      className={`px-2 text-sm text-black py-0.5 bg-white rounded border ${
                        n === page
                          ? 'bg-purple-600 text-white'
                          : 'hover:bg-yellow-600'
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
              className="px-2 py-1 text-sm text-white bg-purple-600 rounded border disabled:opacity-50"
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
