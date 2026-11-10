import { Toaster } from 'react-hot-toast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getToken } from './authFetch';

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
import GuiasPage from './components/GuiasPage';
import TiendaPage from './components/TiendaPage';

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

// 🏷️ filterType admite varios tipos separados por coma (ej. "Player,Fan").
// Se combinan con O. "Nuevo" no filtra: solo ordena por más reciente.
const parseTypes = (ft = '') =>
  String(ft || '').split(',').map((t) => t.trim()).filter((t) => t && t !== 'Todos');

const matchesType = (product, t) => {
  if (t === 'Ofertas') return Number(product.discountPrice) > 0 && Number(product.discountPrice) < Number(product.price);
  if (t === 'Populares') return product.isPopular === true;
  if (t === 'Mundial 2026') return product.isMundial2026 === true;
  if (t === 'Temp 26-27' || t === 'Temporada 26-27') {
    return product.isTemporada2627 === true || /26-27/i.test(String(product.type || ''));
  }
  if (t === 'Balon' || t === 'Balón' || t === 'Balones') return product.type === 'Balón' || product.type === 'Balones';
  return product.type === t;
};

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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
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
  // La intro solo se muestra en la portada: no bloquea enlaces directos a productos ni páginas admin
  const [showIntro, setShowIntro] = useState(!hasLinkFilters && window.location.pathname === '/');

  useEffect(() => {
    if (showIntro) {
      // Respaldo por si la intro falla (la intro dura ~4.9s y se cierra sola)
      const fallbackTimer = setTimeout(() => {
        setShowIntro(false);
      }, 8000);
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
  const [soloOcultos, setSoloOcultos] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegisterUserModal, setShowRegisterUserModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [showMedidas, setShowMedidas] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(20); // múltiplo de 2 y 4 columnas: filas completas
  const [total, setTotal] = useState(0);

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
      const parsed = storedUser ? JSON.parse(storedUser) : null;
      // Sesiones guardadas antes de la actualización de seguridad no tienen token: hay que volver a entrar
      if (parsed && !parsed.token) {
        localStorage.removeItem('user');
        setTimeout(() => toast.info('Por seguridad, iniciá sesión de nuevo.'), 800);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // Token vencido o usuario eliminado: el backend responde 401 y cerramos la sesión
  useEffect(() => {
    const onExpired = () => {
      setUser((prev) => {
        if (prev) toast.info('Tu sesión venció. Iniciá sesión de nuevo.');
        return null;
      });
      localStorage.removeItem('user');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const isSuperUser = user?.isSuperUser || false;

  // 🔥 IDENTIFICAR SI ES EL USUARIO "TIENDA" PARA PERMITIRLE VER HISTORIAL Y DEMÁS SECCIONES 🔥
  const usernameLower = String(user?.username || user?.name || user?.firstName || "").trim().toLowerCase();
  const esSoloUsuarioTienda = !isSuperUser && (
    usernameLower === "tienda" || 
    usernameLower.includes("tienda") || 
    user?.role === "tienda" || 
    user?.rol === "tienda" ||
    user?.roles?.includes("tienda")
  );

  const canSeeHistory = isSuperUser || esSoloUsuarioTienda || user?.roles?.includes('history');
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

      // Al backend solo se le manda el tipo si hay uno; con varios, el filtrado fino
      // lo hace allMatchingProducts sobre el catálogo completo.
      const tps = parseTypes(tp);
      const restrictive = tps.filter((t) => t !== 'Nuevo');
      if (tps.includes('Nuevo')) params.append('sort', 'desc');
      if (restrictive.length === 1) params.append('type', restrictive[0]);

      const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
        headers: { "x-admin": isAdmin ? "true" : "false" },
        signal
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      setProducts(json.items);
      setTotal(json.total);
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
      const isAdmin =
        user?.isSuperUser ||
        user?.roles?.includes("edit") ||
        user?.roles?.includes("add") ||
        user?.roles?.includes("delete");

      let pageN = 1;
      const pageSize = 100; // El backend permite máximo 100 por página
      const acc = [];
      while (true) {
        const params = new URLSearchParams({
          page: String(pageN),
          limit: String(pageSize),
          t: Date.now().toString(),
        });
        const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, {
          headers: { "x-admin": isAdmin ? "true" : "false" },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        acc.push(...items);
        if (!json.total || acc.length >= json.total || items.length === 0) break;
        pageN += 1;
      }
      setAllProductsForCounts(acc);
    } catch {
      setAllProductsForCounts([]);
    }
  };

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      auth: { token: getToken() }, // con token recibe los datos completos; sin token, la versión pública
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
  }, [location.pathname, user]);

  // 🔥 4. ACTUALIZA LA BÚSQUEDA Y PIDE LOS DATOS
  useEffect(() => {
    if (location.pathname === '/') {
      updateURLParams(searchTerm, filterType, filterSizes);
    }
    
    fetchProducts({ page, q: searchTerm, type: filterType });
  }, [page, searchTerm, filterType, filterSizes, storeView]);

  // 🔥 5. SCROLL INMEDIATO
  useEffect(() => {
    const hasFilters = searchTerm !== '' || filterType !== '' || filterSizes.length > 0 || soloOcultos || page > 1;
    
    setTimeout(() => {
      if (hasFilters && pageTopRef.current) {
        const yOffset = pageTopRef.current.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: yOffset, behavior: 'smooth' });
      } else if (!hasFilters && page === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50); 
  }, [searchTerm, filterType, filterSizes, soloOcultos, page]);

  const refreshCounts = () => {
    setTimeout(() => fetchAllForCounts(), 600);
  };

  const handleProductUpdate = (updatedProduct, deletedId = null) => {
    if (deletedId) {
      setProducts((prev) => prev.filter((p) => getPid(p) !== String(deletedId)));
      setAllProductsForCounts((prev) => prev.filter((p) => getPid(p) !== String(deletedId)));
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
    setAllProductsForCounts((prev) =>
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

  const removeAccents = (str = '') => {
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // 🔥 VERIFICADOR EXACTO DE TALLAS Y TIENDAS (SIN DEJAR HUECOS EN LAS PÁGINAS)
  const checkProductStockAndSizes = (product) => {
    const tObj = product.tienda || {};
    const sObj = product.stock || {};
    const bObj = product.bodega || {};

    const getQtyInStore = (obj, size) => Number(obj?.[size] ?? 0);
    const hasAnySizeInObj = (obj) => Object.values(obj || {}).some((v) => Number(v) > 0);

    const activeStore = isSuperUser ? storeView : 'todos';

    // Si el usuario seleccionó tallas en el filtro (ej. ['M'])
    if (filterSizes.length > 0) {
      return filterSizes.some((sz) => {
        const sizeKey = String(sz).trim();
        if (activeStore === 'tienda') return getQtyInStore(tObj, sizeKey) > 0;
        if (activeStore === 'bodega1' || activeStore === 'tienda1') return getQtyInStore(sObj, sizeKey) > 0;
        if (activeStore === 'bodega2' || activeStore === 'tienda2') return getQtyInStore(bObj, sizeKey) > 0;
        return (
          getQtyInStore(tObj, sizeKey) > 0 ||
          getQtyInStore(sObj, sizeKey) > 0 ||
          getQtyInStore(bObj, sizeKey) > 0
        );
      });
    }

    // Si no seleccionó talla pero el SuperAdmin está filtrando por una vista de inventario específica
    if (activeStore === 'tienda') return hasAnySizeInObj(tObj);
    if (activeStore === 'bodega1' || activeStore === 'tienda1') return hasAnySizeInObj(sObj);
    if (activeStore === 'bodega2' || activeStore === 'tienda2') return hasAnySizeInObj(bObj);

    return true;
  };

  // 🔥 FILTRADO GLOBAL SOBRE TODO EL CATÁLOGO PARA QUE NUNCA DEJE PÁGINAS CON HUECOS (10 y 10)
  // Y PARA QUE BUSCAR "real madrid player" BUSQUE EN NOMBRE + CATEGORÍA A LA VEZ
  const usingFullCatalog = allProductsForCounts.length > 0;

  const activeTypes = useMemo(() => parseTypes(filterType), [filterType]);

  const allMatchingProducts = useMemo(() => {
    const sourceList = usingFullCatalog ? allProductsForCounts : products;
    const searchWords = removeAccents(searchTerm.toLowerCase())
      .split(/\s+/)
      .filter(Boolean);

    const filtered = sourceList.filter((product) => {
      if (soloOcultos) {
        if (!product.hidden) return false;
      } else {
        if (!canEdit && product.hidden === true) return false;
      }

      // 🔥 Ocultar productos agotados a los usuarios clientes
      if (!canEdit) {
        const totalStockGlobal = Object.values(product.tienda || {}).reduce((a, b) => a + Number(b || 0), 0) +
                                 Object.values(product.stock || {}).reduce((a, b) => a + Number(b || 0), 0) +
                                 Object.values(product.bodega || {}).reduce((a, b) => a + Number(b || 0), 0);
        if (totalStockGlobal <= 0) return false;
      }

      // Buscar cada palabra escrita tanto en el nombre como en el tipo (ej: "real madrid player")
      if (searchWords.length > 0) {
        const fullSearchableText = removeAccents(
          `${product.name || ''} ${product.type || ''}`.toLowerCase()
        );
        const matchesAllWords = searchWords.every((word) =>
          fullSearchableText.includes(word)
        );
        if (!matchesAllWords) return false;
      }

      // Validar tallas y ubicación
      if (!checkProductStockAndSizes(product)) return false;

      const restrictive = activeTypes.filter((t) => t !== 'Nuevo');
      if (restrictive.length === 0) return true;
      return restrictive.some((t) => matchesType(product, t));
    });

    if (usingFullCatalog) {
      if (activeTypes.includes('Nuevo')) {
        filtered.sort((a, b) => String(b._id || '').localeCompare(String(a._id || '')));
      } else {
        filtered.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      }
    }

    return filtered;
  }, [allProductsForCounts, products, usingFullCatalog, searchTerm, activeTypes, filterSizes, storeView, canEdit, isSuperUser, soloOcultos]);

  const effectiveTotal = usingFullCatalog ? allMatchingProducts.length : total;
  const pages = Math.max(1, Math.ceil(effectiveTotal / limit));

  const filteredProducts = useMemo(() => {
    if (usingFullCatalog) {
      const start = (page - 1) * limit;
      return allMatchingProducts.slice(start, start + limit);
    }
    return allMatchingProducts;
  }, [usingFullCatalog, allMatchingProducts, page, limit]);

  return (
    <>
      <AnimatePresence>
        {showIntro && <WorldCupIntro onFinished={() => setShowIntro(false)} />}
      </AnimatePresence>

      {/* 🔥 FONDO BLANCO MINIMALISTA PREMIUM 🔥 */}
      <div 
        className={showIntro ? "hidden" : "flex flex-col min-h-screen text-black bg-white"}
      >

        {/* ================= MODALES GLOBALES ================= */}
        {showRegisterUserModal && <RegisterUserModal onClose={() => setShowRegisterUserModal(false)} />}
        {showUserListModal && <UserListModal open={showUserListModal} onClose={() => setShowUserListModal(false)} currentUser={user} token={user?.token} />}
        <Medidas open={showMedidas} onClose={() => setShowMedidas(false)} currentType={activeTypes.find((t) => t !== 'Nuevo') || 'Todos'} />
        {showAddModal && (
          <AddProductModal
            user={user}
            tallaPorTipo={tallaPorTipo}
            onAdd={(newProduct) => {
              setProducts((prev) => [newProduct, ...prev]);
              setAllProductsForCounts((prev) => [newProduct, ...prev]);
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
              setSoloOcultos(false);
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
                products={allProductsForCounts.length > 0 ? allProductsForCounts : products} 
                loadingProducts={loading && allProductsForCounts.length === 0} 
                onClose={handleProductClose} 
                onUpdate={handleProductUpdate} 
                user={user} 
                storeView={storeView} 
                canEdit={canEdit} 
                canDelete={canDelete} 
              />
            } />

            <Route path="/comisiones" element={<ComisionesPage isSuperUser={isSuperUser} user={user} />} />
            <Route path="/guias" element={<GuiasPage isSuperUser={isSuperUser} user={user} />} />
            <Route path="/tienda" element={<TiendaPage isSuperUser={isSuperUser} user={user} />} />

            <Route path="/" element={
              <>
                {!loading && allProductsForCounts?.length > 0 && (
                <Cantidad products={allProductsForCounts} isSuperUser={isSuperUser} />
                )}

                {canAdd && !anyModalOpen && (
                <button
                    className="fab-add"
                    onClick={() => setShowAddModal(true)}
                    title="Añadir producto"
                    aria-label="Añadir producto"
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

                {/* 🔥 VISTA DE INVENTARIO (Fondo claro blanco/negro/gris) 🔥 */}
                {isSuperUser && (
                <div className="w-full max-w-7xl mx-auto px-4 mt-6">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 bg-zinc-50 border border-zinc-200 p-4 rounded-2xl shadow-sm">
                    <span className="text-sm font-black text-zinc-800 uppercase tracking-tight mr-2">
                        Vista de Inventario:
                    </span>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <button
                        onClick={() => { setStoreView('todos'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'todos' 
                            ? 'bg-black text-white border-black shadow-md' 
                            : 'bg-white text-zinc-600 border-zinc-300 hover:border-black hover:text-black'
                        }`}
                        >
                        Todas
                        </button>
                        <button
                        onClick={() => { setStoreView('tienda'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'tienda' 
                            ? 'bg-black text-white border-black shadow-md' 
                            : 'bg-white text-gray-600 border-gray-300 hover:border-black hover:text-black'
                        }`}
                        >
                        Tienda
                        </button>
                        <button
                        onClick={() => { setStoreView('bodega1'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'bodega1' 
                            ? 'bg-black text-white border-black shadow-md' 
                            : 'bg-white text-gray-600 border-gray-300 hover:border-black hover:text-black'
                        }`}
                        >
                        Bodega 1
                        </button>
                        <button
                        onClick={() => { setStoreView('bodega2'); setLoading(true); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                            storeView === 'bodega2' 
                            ? 'bg-black text-white border-black shadow-md' 
                            : 'bg-white text-gray-600 border-gray-300 hover:border-black hover:text-black'
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
                      if (!usingFullCatalog) setLoading(true);
                      setPage(1);
                    }
                  }}
                  filterType={filterType}
                  setFilterType={(t) => { 
                    if (t !== filterType) {
                      setFilterType(t); 
                      if (!usingFullCatalog) setLoading(true); 
                      setPage(1); 
                    }
                  }}
                  filterSizes={filterSizes}
                  setFilterSizes={(sizes) => { 
                    setFilterSizes(sizes); 
                    if (!usingFullCatalog) setLoading(true); 
                    setPage(1); 
                  }}
                  onOpenMedidas={() => setShowMedidas(true)}
                  esSuperAdmin={isSuperUser}
                  soloOcultos={soloOcultos}
                  setSoloOcultos={(val) => {
                    setSoloOcultos(val);
                    setPage(1);
                  }}
                />

                {/* La guía de tallas ahora se abre desde el botón "Guía de tallas" del FilterBar */}
                <div className="mb-6 sm:mb-8" />

                <div ref={pageTopRef} />

                {/* max-w-7xl (1280px): el CDN de Tailwind 2.x no soporta max-w-[1400px] */}
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div id="products-section" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {loading && !usingFullCatalog ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-3 w-full animate-pulse bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="w-full bg-gray-200 rounded-xl" style={{ paddingTop: '115%' }}></div>
                        <div className="w-3/4 h-5 bg-gray-200 rounded-full mt-2"></div>
                        <div className="w-1/2 h-5 bg-gray-200 rounded-full"></div>
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
                      <div className="col-span-full empty-state">
                      <span className="empty-state-icon" aria-hidden="true">⚽</span>
                      <p className="empty-state-title">Sin resultados</p>
                      <p className="empty-state-text">
                      {filterSizes.length > 0
                          ? `No tenemos disponibles en talla ${filterSizes.join(', ')} por ahora en esta vista.`
                          : storeView !== 'todos'
                          ? `No hay inventario disponible para la tienda seleccionada.`
                          : 'No tenemos productos disponibles en este momento.'}
                      </p>
                      {(searchTerm || filterType || filterSizes.length > 0) && (
                        <button
                          type="button"
                          className="empty-state-btn"
                          onClick={() => { setSearchTerm(''); setFilterType(''); setFilterSizes([]); setPage(1); }}
                        >
                          Ver todo el catálogo
                        </button>
                      )}
                      </div>
                  )}
                  </div>
                </div>

                {/* === PAGINACIÓN BLANCO Y NEGRO === */}
                {pages > 1 && !(loading && !usingFullCatalog) && (
                  <nav className="pg" aria-label="Paginación">
                    <div className="pg-row">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="pg-btn pg-btn--arrow"
                        aria-label="Página anterior"
                      >
                        <FaChevronLeft />
                      </button>

                      {(() => {
                        const nums = buildPages(page, pages);
                        return nums.map((n, i) => {
                          const prev = nums[i - 1];
                          const showDots = i > 0 && n - prev > 1;
                          const isCurrent = n === page;
                          return (
                            <span key={n} className="pg-group">
                              {showDots && <span className="pg-dots">…</span>}
                              <button
                                type="button"
                                onClick={() => setPage(n)}
                                className={`pg-btn ${isCurrent ? 'is-current' : ''}`}
                                aria-current={isCurrent ? 'page' : undefined}
                              >
                                {n}
                              </button>
                            </span>
                          );
                        });
                      })()}

                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="pg-btn pg-btn--arrow"
                        aria-label="Página siguiente"
                      >
                        <FaChevronRight />
                      </button>
                    </div>
                    <span className="pg-info">Página {page} de {pages} · {effectiveTotal} productos</span>
                  </nav>
                )}
                {/* ======================= */}
              </>
            } />
          </Routes>
        </main>

        <Footer />
        {/* El WhatsApp para clientes no se muestra en las páginas de administración */}
        {!anyModalOpen && !['/tienda', '/comisiones', '/guias', '/history'].includes(location.pathname) && <FloatingWhatsapp />}

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