import { Toaster } from 'react-hot-toast';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';

import Header from './components/Header';
import FilterBar from './components/FilterBar';
import ProductCard from './components/ProductCard';
import ProductScreen from './components/ProductScreen'; 
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
import UserListModal from './components/UserListModal';
import HistoryPage from './components/HistoryPage'; 
import Medidas from './components/Medidas';
import Cantidad from './components/Cantidad';
import Bienvenido from './components/Bienvenido';
import WorldCupIntro from './components/WorldCupIntro';
import ComisionesPage from './components/ComisionesPage';

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

// 🎯 FUNCIÓN DE PÁGINAS 100% GARANTIZADA
function buildPages(page, pages) {
  const pageNumbers = [];
  for (let i = 1; i <= pages; i++) {
    if (
      i === 1 ||
      i === pages ||
      (i >= page - 2 && i <= page + 2)
    ) {
      pageNumbers.push(i);
    }
  }
  return pageNumbers;
}

const getPid = (p) => String(p?._id ?? p?.id ?? '');

function ProductDetailWrapper({ products, loadingProducts, onClose, onUpdate, user, storeView, canEdit, canDelete }) {
  const { id } = useParams();
  const [localProduct, setLocalProduct] = useState(null);
  const [isFetchingId, setIsFetchingId] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const found = products.find(p => getPid(p) === id);
    if (found) {
      setLocalProduct(found);
      setIsFetchingId(false);
    } else {
      fetch(`${API_BASE}/api/products/${id}`)
        .then(res => {
          if (!res.ok) throw new Error("No encontrado");
          return res.json();
        })
        .then(data => {
          setLocalProduct(data);
          setIsFetchingId(false);
        })
        .catch(() => {
          setError(true);
          setIsFetchingId(false);
        });
    }
  }, [id, products]);

  if (loadingProducts || isFetchingId) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="w-10 h-10 border-4 border-[#333] border-t-yellow-500 rounded-full animate-spin"></div>
    </div>
  );

  if (error || (!isFetchingId && !localProduct)) return <Navigate to="/" replace />;

  return (
    <ProductScreen
      key={`${getPid(localProduct)}-${localProduct.updatedAt || ''}`}
      product={localProduct}
      onClose={onClose}
      onUpdate={onUpdate}
      canEdit={canEdit}
      canDelete={canDelete}
      user={user}
      storeView={storeView}
    />
  );
}

function MainApp() {
  // 🔥 1. IMPORTAMOS PARÁMETROS DE LA URL
  const [searchParams, setSearchParams] = useSearchParams();

  // 🔥 2. SI HAY UN LINK DIRECTO, SALTAMOS LA ANIMACIÓN DE INICIO
  const hasLinkFilters = !!(searchParams.get('q') || searchParams.get('type') || searchParams.get('sizes'));
  const [showIntro, setShowIntro] = useState(!hasLinkFilters); 

  useEffect(() => {
    if (showIntro) {
      const fallbackTimer = setTimeout(() => {
        setShowIntro(false);
      }, 4500);
      return () => clearTimeout(fallbackTimer);
    }
  }, [showIntro]);

  const [products, setProducts] = useState([]);
  const [allProductsForCounts, setAllProductsForCounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [savedScroll, setSavedScroll] = useState(0);

  // 🔥 3. INICIALIZAMOS LOS ESTADOS LEYENDO LA URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [filterType, setFilterType] = useState(searchParams.get('type') || '');
  const [filterSizes, setFilterSizes] = useState(
    searchParams.get('sizes') ? searchParams.get('sizes').split(',') : []
  );

  const updateURLParams = (q, type, sizes) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (sizes && sizes.length > 0) params.set('sizes', sizes.join(','));
    setSearchParams(params, { replace: true });
  };

  const [storeView, setStoreView] = useState('todos');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterUserModal, setShowRegisterUserModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [showMedidas, setShowMedidas] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(21);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / limit));

  const navigate = useNavigate();
  const location = useLocation();

  const abortControllerRef = useRef(null);
  const pageTopRef = useRef(null);

  const anyModalOpen =
    showAddModal ||
    showLogin ||
    showRegisterUserModal ||
    showUserListModal ||
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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(q ? { q } : {}),
        ...(filterSizes.length ? { sizes: filterSizes.join(',') } : {}),
        ...(isSuperUser && storeView !== 'todos' ? { storeView } : {})
      });

      if (tp === 'Nuevo') {
        params.append('sort', 'desc');
      } else if (tp) {
        params.append('type', tp);
      }

      const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
        headers: { "x-admin": isAdmin ? "true" : "false" },
        signal
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      setProducts(json.items);
      setTotal(json.total);
      setPage(json.page);
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      setProducts([]);
      setTotal(0);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
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

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    socket.on('productoActualizado', (updatedProd) => {
      if (!updatedProd) return;
      const pid = getPid(updatedProd);

      setProducts((prev) =>
        prev.map((p) => (getPid(p) === pid ? { ...p, ...updatedProd } : p))
      );

      setAllProductsForCounts((prev) =>
        prev.map((p) => (getPid(p) === pid ? { ...p, ...updatedProd } : p))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/') {
      fetchProducts({ page, q: searchTerm, type: filterType });
      fetchAllForCounts();
    }
  }, [location.pathname]);

  // 🔥 4. ACTUALIZA LA BÚSQUEDA Y PIDE LOS DATOS
  useEffect(() => {
    if (location.pathname === '/') {
      updateURLParams(searchTerm, filterType, filterSizes);
    }
    
    fetchProducts({ page, q: searchTerm, type: filterType });
  }, [page, searchTerm, filterType, filterSizes, storeView]);

  // 🔥 5. SCROLL INMEDIATO
  useEffect(() => {
    const hasFilters = searchTerm !== '' || filterType !== '' || filterSizes.length > 0 || page > 1;
    
    setTimeout(() => {
      if (hasFilters && pageTopRef.current) {
        const yOffset = pageTopRef.current.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: yOffset, behavior: 'smooth' });
      } else if (!hasFilters && page === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50); 
  }, [searchTerm, filterType, filterSizes, page]);

  useEffect(() => {
    if (products.length > 0) fetchAllForCounts();
  }, [products]);

  const refreshCounts = () => {
    setTimeout(() => fetchAllForCounts(), 600);
  };

  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts((prev) => prev.filter((p) => getPid(p) !== String(deletedId)));
      navigate('/');
      setTimeout(() => window.scrollTo({ top: savedScroll, behavior: 'instant' }), 10);
      toast.success('Producto eliminado correctamente');
      refreshCounts();
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        getPid(p) === getPid(updatedProduct) ? { ...p, ...updatedProduct } : p
      )
    );
    refreshCounts();
  };

  const handleProductClose = () => {
    navigate('/');
    setTimeout(() => window.scrollTo({ top: savedScroll, behavior: 'instant' }), 10);
  };

  const handleProductClick = (product) => {
    setSavedScroll(window.scrollY);
    navigate(`/producto/${getPid(product)}`);
  };

  const handleLoginClick = () => setShowLogin(true);

  const handleRegisterClick = () =>
    setTimeout(() => setShowRegisterUserModal(true), 100);

  const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const filteredProducts = products.filter((product) => {
    if (!canEdit && product.hidden === true) return false;

    const normalizedSearch = removeAccents(searchTerm.toLowerCase());
    const normalizedProductName = removeAccents(product.name.toLowerCase());

    const matchName = normalizedProductName.includes(normalizedSearch);
    if (!matchName) return false;

    if (!filterType || filterType === 'Todos') return true;

    if (filterType === 'Ofertas') return Number(product.discountPrice) > 0;
    if (filterType === 'Populares') return product.isPopular === true;
    if (filterType === 'Nuevo') return true; 
    if (filterType === 'Mundial 2026') return product.isMundial2026 === true;
    if (filterType === 'Temp 26-27') return product.isTemporada2627 === true;

    if (filterType === 'Balon' || filterType === 'Balón' || filterType === 'Balones') {
      return product.type === 'Balón' || product.type === 'Balones';
    }

    return product.type === filterType;
  });

  return (
    <>
      <AnimatePresence>
        {showIntro && <WorldCupIntro onFinished={() => setShowIntro(false)} />}
      </AnimatePresence>

      {/* 🔥 FONDO CASI NEGRO MINIMALISTA PREMIUM (Tonos oscuros directos en HEX) 🔥 */}
      <div 
        className={showIntro ? "hidden" : "flex flex-col min-h-screen text-white"}
        style={{ background: 'linear-gradient(to bottom, #050505, #121212)' }}
      >

        {/* ================= MODALES GLOBALES ================= */}
        {showRegisterUserModal && <RegisterUserModal onClose={() => setShowRegisterUserModal(false)} />}
        {showUserListModal && <UserListModal open={showUserListModal} onClose={() => setShowUserListModal(false)} currentUser={user} token={user?.token} />}
        {showMedidas && <Medidas open={showMedidas} onClose={() => setShowMedidas(false)} currentType={filterType || 'Todos'} />}
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
        <ToastContainer />
        <Toaster position="top-center" reverseOrder={false} />

        {/* ================= HEADER GLOBAL ================= */}
        <TopBanner />
        {!anyModalOpen && (
          <Header
            onLoginClick={handleLoginClick}
            onLogout={handleLogout}
            onLogoClick={() => {
              setFilterType('');
              setSearchTerm('');
              setFilterSizes([]);
              setPage(1);
              navigate('/');
            }}
            user={user}
            isSuperUser={isSuperUser}
            setShowRegisterUserModal={setShowRegisterUserModal}
            setShowUserListModal={setShowUserListModal}
            setShowHistoryModal={() => navigate('/history')}
            canSeeHistory={canSeeHistory}
            filterType={filterType}
            setFilterType={(t) => { 
              if (t !== filterType) {
                setFilterType(t); 
                setLoading(true); 
                setPage(1); 
              }
            }}
          />
        )}

        {/* ================= SISTEMA DE RUTAS ================= */}
        <main className="flex-1 w-full relative">
          <Routes>
            <Route path="/history" element={<HistoryPage isSuperUser={isSuperUser} />} />
            <Route path="/producto/:id" element={
              <ProductDetailWrapper 
                products={products} 
                loadingProducts={loading} 
                onClose={handleProductClose} 
                onUpdate={handleProductUpdate} 
                user={user} 
                storeView={storeView} 
                canEdit={canEdit} 
                canDelete={canDelete} 
              />
            } />

            <Route path="/comisiones" element={<ComisionesPage isSuperUser={isSuperUser} user={user} />} />

            <Route path="/" element={
              <>
                {!loading && allProductsForCounts?.length > 0 && (
                <Cantidad products={allProductsForCounts} isSuperUser={isSuperUser} />
                )}

                {canAdd && !anyModalOpen && (
                <button
                    className="fixed bottom-6 right-6 bg-yellow-500 text-black p-4 rounded-full shadow-lg hover:bg-yellow-400 transition z-50"
                    onClick={() => setShowAddModal(true)}
                    title="Añadir producto"
                >
                    <FaPlus />
                </button>
                )}

                <Bienvenido onNavigate={(type, search = '') => {
                  setSearchTerm(search);
                  setFilterType(type);
                  setLoading(true);
                  setPage(1);

                  if (pageTopRef.current) {
                    pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    const section = document.getElementById('products-section');
                    if (section) section.scrollIntoView({ behavior: 'smooth' });
                  }
                }} />

                {/* 🔥 VISTA DE INVENTARIO (Ajustada para fondo oscuro) 🔥 */}
                {isSuperUser && (
                <div className="w-full max-w-7xl mx-auto px-4 mt-6">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 bg-black/40 border border-white/10 p-4 rounded-2xl shadow-sm">
                    <span className="text-sm font-black text-gray-200 uppercase tracking-tight mr-2">
                        Vista de Inventario:
                    </span>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <button
                        onClick={() => { setStoreView('todos'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'todos' 
                            ? 'bg-yellow-500 text-black border-yellow-500 shadow-md' 
                            : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-300 hover:text-gray-200'
                        }`}
                        >
                        Todas
                        </button>
                        <button
                        onClick={() => { setStoreView('tienda'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'tienda' 
                            ? 'bg-yellow-500 text-black border-yellow-500 shadow-md' 
                            : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-300 hover:text-gray-200'
                        }`}
                        >
                        Tienda
                        </button>
                        <button
                        onClick={() => { setStoreView('bodega1'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'bodega1' 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-transparent text-gray-400 border-gray-700 hover:border-blue-500 hover:text-blue-500'
                        }`}
                        >
                        Bodega 1
                        </button>
                        <button
                        onClick={() => { setStoreView('bodega2'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'bodega2' 
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                            : 'bg-transparent text-gray-400 border-gray-700 hover:border-purple-500 hover:text-purple-500'
                        }`}
                        >
                        Bodega 2
                        </button>
                    </div>
                    </div>
                </div>
                )}

                <FilterBar
                  searchTerm={searchTerm}
                  setSearchTerm={(val) => {
                    if (val !== searchTerm) {
                      setSearchTerm(val);
                      setLoading(true);
                      setPage(1);
                    }
                  }}
                  filterType={filterType}
                  setFilterType={(t) => { 
                    if (t !== filterType) {
                      setFilterType(t); 
                      setLoading(true); 
                      setPage(1); 
                    }
                  }}
                  filterSizes={filterSizes}
                  setFilterSizes={(sizes) => { 
                    setFilterSizes(sizes); 
                    setLoading(true); 
                    setPage(1); 
                  }}
                />

                <div className="w-full max-w-7xl mx-auto px-4 mt-8 mb-8">
                  <div className="flex items-center justify-center gap-3 mt-4 mb-8 w-full">
                      <span className="text-sm sm:text-base text-gray-300 font-medium">¿Querés saber tu talla?</span>
                      <button onClick={() => setShowMedidas(true)} className="bg-yellow-500 text-black px-5 py-2 rounded-full hover:bg-yellow-400 font-bold text-sm tracking-wide shadow-md transition-transform hover:scale-105">
                      VER MEDIDAS
                      </button>
                  </div>
                </div>

                <div ref={pageTopRef} />

                <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                  <div id="products-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-3 w-full animate-pulse bg-[#111] p-4 rounded-3xl border border-[#222]">
                        <div className="w-full h-[350px] bg-[#222] rounded-2xl"></div>
                        <div className="w-3/4 h-5 bg-[#222] rounded-full mt-2"></div>
                        <div className="w-1/2 h-5 bg-[#222] rounded-full"></div>
                      </div>
                    ))
                  ) : filteredProducts.length > 0 ? (
                      filteredProducts.map((product, index) => (
                      <ProductCard
                          key={getPid(product)}
                          product={product}
                          index={index}
                          onClick={() => handleProductClick(product)}
                          user={user}
                      />
                      ))
                  ) : (
                      <div className="col-span-full text-center text-gray-400 font-semibold py-10 bg-[#111] rounded-2xl border border-[#222]">
                      {filterSizes.length > 0
                          ? `No tenemos disponibles en talla ${filterSizes.join(', ')} por ahora en esta vista.`
                          : storeView !== 'todos'
                          ? `No hay inventario disponible para la tienda seleccionada.`
                          : 'No tenemos productos disponibles en este momento.'}
                      </div>
                  )}
                  </div>
                </div>

                {/* === PAGINACIÓN MEJORADA (Ajustada para fondo oscuro) === */}
                {pages > 1 && !loading && (
                  <div className="mt-16 mb-20 flex flex-col items-center gap-3">
                    <nav className="flex items-center justify-center gap-2 sm:gap-3">
                      
                      {/* Botón Anterior */}
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-3 text-xs text-black bg-yellow-500 rounded-xl hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                      >
                        <FaChevronLeft size={14} />
                      </button>

                      {/* Números de página */}
                      {(() => {
                        const nums = buildPages(page, pages);
                        return nums.map((n, i) => {
                          const prev = nums[i - 1];
                          const showDots = i > 0 && n - prev > 1;
                          const isCurrent = n === page;

                          return (
                            <span key={n} className="flex items-center gap-1.5">
                              {showDots && <span className="px-2 text-yellow-500 font-bold text-sm tracking-widest">...</span>}
                              <button
                                onClick={() => setPage(n)}
                                className={`min-w-[40px] h-10 px-3 text-sm font-black rounded-xl transition-all cursor-pointer border-2 ${
                                  isCurrent
                                    ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-[1.05]'
                                    : 'bg-[#111] text-yellow-500 border-[#333] hover:border-yellow-500 hover:bg-[#222]'
                                }`}
                              >
                                {n}
                              </button>
                            </span>
                          );
                        });
                      })()}

                      {/* Botón Siguiente */}
                      <button
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="p-3 text-xs text-black bg-yellow-500 rounded-xl hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                      >
                        <FaChevronRight size={14} />
                      </button>
                    </nav>
                    
                    {/* Indicador de página actual */}
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">
                      Página {page} de {pages}
                    </span>
                  </div>
                )}
                {/* ======================= */}
              </>
            } />
          </Routes>
        </main>

        <Footer />
        {!anyModalOpen && <FloatingWhatsapp />}

      </div>
    </>
  );
}

export default function AppWrapper() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}