import { Toaster } from 'react-hot-toast';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { FaPlus, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import TopBanner from './components/TopBanner';
import UserDropdown from './components/UserDropDown';
import UserListModal from './components/UserListModal';
import HistoryModal from './components/HistoryModal';
import Medidas from './components/Medidas';
import Cantidad from './components/Cantidad';
import Bienvenido from './components/Bienvenido';

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

function buildPages(page, pages) {
  const out = new Set([1, pages, page, page - 1, page - 2, page + 1, page + 2]);
  return [...out]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
}

const getPid = (p) => String(p?._id ?? p?.id ?? '');

function App() {
  const [products, setProducts] = useState([]);
  const [allProductsForCounts, setAllProductsForCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSizes, setFilterSizes] = useState([]);
  const [showSizes, setShowSizes] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterUserModal, setShowRegisterUserModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMedidas, setShowMedidas] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / limit));

  const anyModalOpen =
    !!selectedProduct ||
    showAddModal ||
    showLogin ||
    showRegisterUserModal ||
    showUserListModal ||
    showHistoryModal ||
    showMedidas;

  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const isSuperUser = user?.isSuperUser || false;
  const canSeeHistory = user?.isSuperUser || user?.roles?.includes('history');
  const canAdd = user?.isSuperUser || user?.roles?.includes('add');
  const canEdit = user?.isSuperUser || user?.roles?.includes('edit');
  const canDelete = user?.isSuperUser || user?.roles?.includes('delete');

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast.success('Sesión cerrada correctamente');
  };

  const fetchProducts = async (opts = {}) => {
    const p = opts.page ?? page;
    const q = (opts.q ?? searchTerm).trim();
    const tp = (opts.type ?? filterType).trim();

    const isAdmin =
      user?.isSuperUser ||
      user?.roles?.includes("edit") ||
      user?.roles?.includes("add") ||
      user?.roles?.includes("delete");

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(q ? { q } : {}),
        ...(filterSizes.length ? { sizes: filterSizes.join(',') } : {}),
      });

      if (tp === 'Nuevo') {
        params.append('sort', 'desc');
      } else if (tp) {
        params.append('type', tp);
      }

      const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
        headers: {
          "x-admin": isAdmin ? "true" : "false"
        }
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      setProducts(json.items);
      setTotal(json.total);
      setPage(json.page);
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllForCounts = async () => {
    try {
      let pageN = 1;
      const pageSize = 200;
      const acc = [];
      while (true) {
        const params = new URLSearchParams({
          page: String(pageN),
          limit: String(pageSize),
          t: Date.now().toString(),
        });
        const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        acc.push(...json.items);
        if (acc.length >= json.total) break;
        pageN += 1;
        await new Promise((r) => setTimeout(r, 100));
      }
      setAllProductsForCounts(acc);
    } catch {
      setAllProductsForCounts([]);
    }
  };

  const pageTopRef = useRef(null);
  
  useEffect(() => {
    fetchProducts({ page, q: searchTerm, type: filterType });
    if (pageTopRef.current) {
      pageTopRef.current.style.scrollMarginTop = '100px'; 
      pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, searchTerm, filterType, filterSizes]);

  useEffect(() => {
    if (products.length > 0) fetchAllForCounts();
  }, [products]);

  const refreshCounts = () => {
    setTimeout(() => fetchAllForCounts(), 600);
  };

  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts((prev) => prev.filter((p) => getPid(p) !== String(deletedId)));
      setIsModalOpen(false); 
      setTimeout(() => setSelectedProduct(null), 300);
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

  const handleLoginClick = () => setShowLogin(true);
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    toast.success('Bienvenido');
  };

  const handleRegisterClick = () =>
    setTimeout(() => setShowRegisterUserModal(true), 100);

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
  const tallasBalon = ['3', '4', '5']; 
  const allSizes = [...tallasAdulto, '16','18','20','22','24','26','28', ...tallasBalon];

  const filteredProducts = products.filter((product) => {
      const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!canEdit && product.hidden === true) return false;
      
      if (filterType === 'Ofertas') return Number(product.discountPrice) > 0 && matchName;
      if (filterType === 'Populares') return product.isPopular === true && matchName;
      if (filterType === 'Nuevo') return matchName;

      // 🔥 CORRECCIÓN 1: Match flexible para Balones (con/sin tilde, singular/plural)
      const matchType = filterType 
        ? (product.type === filterType) || 
          (filterType === 'Balon' && (product.type === 'Balón' || product.type === 'Balones'))
        : true;

      if (filterSizes.length === 0) return matchName && matchType;

      const matchSizes = filterSizes.some((size) => {
        const stockQty = Number(product.stock?.[size] ?? 0);
        const bodegaQty = Number(product.bodega?.[size] ?? 0);
        return stockQty + bodegaQty > 0;
      });

      return matchName && matchType && matchSizes;
    });

  return (
    <>
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

      <Bienvenido onNavigate={(type) => {
        setFilterType(type);
        setPage(1);
      }} />

      <div ref={pageTopRef} />

      {/* 3. BARRA DE FILTROS */}
      <FilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={(t) => { setFilterType(t); setPage(1); }}
          onToggleTallas={() => setShowSizes(!showSizes)}
        />
      

      <div className="w-full max-w-7xl mx-auto px-4 mt-8 mb-8">

        
        {/* 1. SECCIÓN DE TALLAS DESPLEGABLE */}
        <AnimatePresence>
          {showSizes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden bg-white/50 backdrop-blur-sm rounded-xl border border-gray-100 mb-6"
            >
              <div className="flex flex-col gap-6 items-center p-6">
                
                {/* 🔥 CORRECCIÓN 2: Renderizado flexible para Balones */}
                {(filterType === 'Balon' || filterType === 'Balón' || filterType === 'Balones') ? (
                   <div className="w-full text-center">
                    <h3 className="font-semibold mb-2 text-gray-700">Tamaño de Balón</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                       {tallasBalon.map((size) => {
                        const isActive = filterSizes.includes(size);
                        return (
                          <button
                            key={size}
                            onClick={() => setFilterSizes(prev => isActive ? prev.filter(s => s !== size) : [...prev, size])}
                            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                              isActive ? 'bg-black text-white border-black shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full text-center">
                      <h3 className="font-semibold mb-2 text-gray-700">Adulto</h3>
                      <div className="flex flex-wrap justify-center gap-2">
                        {tallasAdulto.map((size) => {
                          const isActive = filterSizes.includes(size);
                          return (
                            <button
                              key={size}
                              onClick={() => setFilterSizes(prev => isActive ? prev.filter(s => s !== size) : [...prev, size])}
                              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                                isActive ? 'bg-black text-white border-black shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="w-full text-center">
                      <h3 className="font-semibold mb-2 text-gray-700">Niño (Talla Costa Rica)</h3>
                      <div className="flex flex-wrap justify-center gap-2">
                        {tallasNino.map(({ size, label }) => {
                          const isActive = filterSizes.includes(size);
                          return (
                            <button
                              key={size}
                              onClick={() => setFilterSizes(prev => isActive ? prev.filter(s => s !== size) : [...prev, size])}
                              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                                isActive ? 'bg-black text-white border-black shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. BOTÓN DE MEDIDAS (SIEMPRE VISIBLE) */}
        <div className="flex items-center justify-center gap-3 mt-4 mb-8 w-full">
          <span className="text-sm sm:text-base text-gray-600 font-medium">¿Querés saber tu talla?</span>
          <button onClick={() => setShowMedidas(true)} className="bg-black text-white px-5 py-2 rounded-full hover:bg-zinc-800 font-bold text-sm tracking-wide shadow-md transition-transform hover:scale-105">
            VER MEDIDAS
          </button>
        </div>

        
      </div>

      {/* GRID DE PRODUCTOS */}
      <div id="products-section" className="px-4 grid grid-cols-2 gap-y-8 gap-x-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <ProductCard
              key={getPid(product)}
              product={product}
              onClick={() => {
                setSelectedProduct(product);
                setTimeout(() => setIsModalOpen(true), 10);
              }}
              user={user}
            />
          ))
        ) : (
          <div className="col-span-full text-center text-gray-600 font-semibold py-10 bg-gray-100 rounded-md">
            {filterSizes.length > 0
              ? `No tenemos disponibles en talla ${filterSizes.join(', ')} por ahora.`
              : 'No tenemos productos disponibles en este momento.'}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          key={`${getPid(selectedProduct)}-${selectedProduct.updatedAt || ''}`}
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTimeout(() => setSelectedProduct(null), 300);
          }}
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
            refreshCounts();
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

      {pages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <nav className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-sm text-white bg-black rounded border disabled:opacity-50"
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
                      className={`px-2 text-sm text-white py-0.5 bg-black rounded ${
                        n === page ? 'bg-gray-600' : 'hover:bg-gray-300'
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