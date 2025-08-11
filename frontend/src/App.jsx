import { Toaster } from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
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
  const [showHistoyModal, setShowHistoryModal] = useState(false);
  

  const [user, setUser] =useState (() => {
    try{
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    }catch(error){
      console.error("Error parsing user from localStorage", error);
      return null;
    }
  });

  const isSuperUser = user?.isSuperUser || false;
  const canAdd = user?.isSuperUser || user?.roles?.includes("add");
  const canEdit = user?.isSuperUser || user?.roles?.includes("edit");
  const canDelete = user?.isSuperUser || user?.roles?.includes("delete");
 


  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    toast.success("Sesión cerrada correctamente");
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("https://chemas-sport-er-backend.onrender.com/api/products");
      if (!res.ok) throw new Error("No se pudo obtener los productos");

      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      toast.error("No se pudieron cargar los productos");
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
      toast.success("Producto eliminado correctamente");
    } else {
      setProducts((prev) =>
        prev.map((p) => 
          String(p._id) === String(updatedProduct._id) ? updatedProduct : p
        )
      );
      toast.success("Producto actualizado correctamente");
    }
  };

  const handleLoginClick = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    toast.success(`Bienvenido`);
  };

  const handleRegisterClick = () => {

    setShowUserDropDown(false);
    setTimeout(() => {
    setShowRegisterUserModal(true);
    },100);


    
  };

  const filteredProducts = products.filter((product) => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType ? product.type === filterType : true;
    return matchName && matchType;
  });

  return (
    <>
    

      {showRegisterUserModal &&(
       <RegisterUserModal
       onClose={() => {
        setShowRegisterUserModal(false);
        setShowUserDropDown(false);

       }}
       />
      )}
      
      {showUserListModal && (
        <UserListModal 
        open = {showUserListModal}
        onClose={() => setShowUserListModal(false)}/>
      )}

      {showHistoyModal && (
        <HistoryModal 
        open = {showHistoyModal}
        onClose={() => setShowHistoryModal(false)}
        isSuperUser={user?.isSuperUser == true}
        />
      )}

      <TopBanner />

      {loading && <LoadingOverlay message="Cargando productos..." />}

      <Header
        onLoginClick={handleLoginClick}
        onLogout={handleLogout}
        user={user}
        isSuperUser={user?.isSuperUser}
        setShowRegisterUserModal={setShowRegisterUserModal}
        setShowUserListModal={setShowUserListModal}
        setShowHistoryModal={setShowHistoryModal}
  
        
      />

      {canAdd && (
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
            toast.success("Producto agregado correctamente");
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
            setShowLogin(false);
            toast.success(`Bienvenido`);
          }}
          onRegisterClick={handleRegisterClick}
        />
      )}

      {showRegisterUserModal && (
        <RegisterUserModal
          onClose={() => setShowRegisterUserModal(false)}
        />
      )}

      <Footer />
      <FloatingWhatsapp />
      <ToastContainer />
      <Toaster position="top-center" reverseOrder={false}/>
    </>
  );
}

export default App;