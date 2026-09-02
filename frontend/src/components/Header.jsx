import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { 
  FaUser, FaTimes, FaHistory, FaUserPlus, FaUsers, FaSignOutAlt, FaChevronRight,
  FaBoxOpen, FaPercentage
} from "react-icons/fa";

export default function Header({
  onLoginClick,
  onLogout,
  onLogoClick,
  user,
  canSeeHistory,
  isSuperUser,
  setShowRegisterUserModal,
  setShowUserListModal,
  setShowHistoryModal,
  filterType,
  setFilterType,
}) {
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setIsDark((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (name) => {
    if (!name) return "US";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const navItems = [
    { label: "TEMPORADA 26-27", value: "Temp 26-27" },
    { label: "NUEVO", value: "Nuevo" },
    { label: "POPULARES", value: "Populares" },
    { label: "MUNDIAL 2026", value: "Mundial 2026" },
    { label: "OFERTAS", value: "Ofertas" },
    { label: "NACIONAL", value: "Nacional" },
    { label: "PLAYER", value: "Player" },
    { label: "FAN", value: "Fan" },
    { label: "RETRO", value: "Retro" },
    { label: "MUJER", value: "Mujer" },
    { label: "NIÑO", value: "Niño" },
    { label: "BALÓN", value: "Balón" },
    { label: "ABRIGOS", value: "Abrigos" },
    { label: "F1", value: "F1" },
    { label: "NBA", value: "NBA" },
    { label: "MLB", value: "MLB" },
    { label: "NFL", value: "NFL" },
  ];

  return (
    <header
      className={`md:sticky md:top-0 z-50 w-full transition-colors duration-1000 shadow-md ${
        isDark ? "bg-black" : "bg-white"
      }`}
    >
      {/* ================= PARTE SUPERIOR (Logo, Título y Usuario) ================= */}
      <div className="relative px-2 sm:px-6 py-2 sm:py-4">
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            isDark ? "opacity-20" : "opacity-70"
          }`}
          style={{
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>

        <div className="relative z-10 flex items-center justify-between w-full">
          <button onClick={onLogoClick} className="focus:outline-none bg-transparent cursor-pointer" title="Volver al inicio">
            <img src={logo} alt="Logo Chemas Sport" className="h-14 sm:h-16 transition-transform duration-700 hover:scale-105" />
          </button>

          <h1
            className={`absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-extrabold tracking-tight transition-colors duration-700 ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            ChemaSport ER
          </h1>

          {/* 🔘 BOTÓN DE USUARIO: DESAPARECE SI EL SIDEBAR ESTÁ ABIERTO */}
          <div className="flex items-center min-w-[44px] justify-end">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title={user ? "Menú de usuario" : "Iniciar sesión"}
                className={`rounded-full p-3 shadow-lg transition-all duration-300 cursor-pointer ${
                  isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {user ? (
                  <div className="w-5 h-5 flex items-center justify-center font-black text-xs">
                    {getInitials(user.firstName || user.username || user.name)}
                  </div>
                ) : (
                  <FaUser size={18} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= PARTE INFERIOR (SubHeader Integrado) ================= */}
      <div className={`hidden md:block w-full border-t transition-colors duration-1000 ${
        isDark ? "border-gray-800" : "border-gray-100/50"
      }`}>
        <div className="max-w-full mx-full px-4">
          <nav className="flex items-center gap-8 py-3.5 overflow-x-auto whitespace-nowrap justify-center px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {navItems.map((item, index) => {
              const isActive = filterType === item.value;
              
              return (
                <button
                  key={index}
                  onClick={() => {
                     if (setFilterType) setFilterType(item.value);
                  }}
                  className={`group relative flex items-center text-xs lg:text-[13px] font-black uppercase tracking-[0.1em] transition-all duration-300 cursor-pointer bg-transparent border-0 outline-none focus:outline-none focus:ring-0 py-1 z-20 ${
                    isActive 
                      ? (isDark ? "text-white" : "text-black") 
                      : (isDark ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-black")
                  }`}
                >
                  {item.label}
                  
                  <span 
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ${
                      isActive 
                        ? `w-full ${isDark ? "bg-white" : "bg-black"}` 
                        : `w-0 group-hover:w-full ${isDark ? "bg-gray-600" : "bg-gray-200"}`
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ========================================================
          🔸 SIDEBAR: FONDO BLANCO Y BOTONES NEGROS
          ======================================================== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="fixed top-0 right-0 h-full w-80 sm:w-88 shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-white h-full flex flex-col justify-between p-6 sm:p-7 shadow-2xl text-black font-sans">
              
              {/* ❌ Botón Cerrar: Sin background y en color negro puro */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-5 right-5 p-1 text-black hover:opacity-60 transition-opacity cursor-pointer z-10 bg-transparent border-0"
                title="Cerrar"
              >
                <FaTimes size={20} />
              </button>

              {user ? (
                /* 🟢 Vista: Con Sesión Iniciada */
                <div className="mt-8 flex-grow overflow-y-auto pr-1">
                  
                  {/* Tarjeta de usuario */}
                  <div className="mb-6 p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                      {getInitials(user.firstName || user.username || user.name)}
                    </div>
                    <div className="overflow-hidden min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Sesión Activa
                      </span>
                      <p className="text-black font-black text-lg leading-tight truncate">
                        {user.firstName || user.username || user.name}
                      </p>
                    </div>
                  </div>

                  {/* Opciones del menú (Botones negros con hover gris suave) */}
                  <nav className="space-y-2.5">
                    
                    

                    {/* 💰 2. Comisiones */}
                    <button
                      onClick={() => {
                        navigate('/comisiones');
                        setSidebarOpen(false);
                      }}
                      className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <FaPercentage size={15} className="text-zinc-400" />
                        <span>Comisiones</span>
                      </div>
                      <FaChevronRight size={12} className="text-zinc-500" />
                    </button>

                    {/* ➕ 3. Agregar usuario */}
                    {(isSuperUser || canSeeHistory || user?.roles?.includes("add")) && (
                      <button
                        onClick={() => {
                          setShowRegisterUserModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <FaUserPlus size={16} className="text-zinc-400" />
                          <span>Agregar usuario</span>
                        </div>
                        <FaChevronRight size={12} className="text-zinc-500" />
                      </button>
                    )}

                    {/* 👥 4. Ver usuarios */}
                    {(isSuperUser || canSeeHistory || user?.roles?.includes("view_users")) && (
                      <button
                        onClick={() => {
                          setShowUserListModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <FaUsers size={16} className="text-zinc-400" />
                          <span>Ver usuarios</span>
                        </div>
                        <FaChevronRight size={12} className="text-zinc-500" />
                      </button>
                    )}

                    {/* 🕒 5. Historial */}
                    {(isSuperUser || canSeeHistory || user?.roles?.includes("history")) && (
                      <button
                        onClick={() => {
                          setShowHistoryModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-black hover:bg-zinc-800 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <FaHistory size={15} className="text-zinc-400" />
                          <span>Historial</span>
                        </div>
                        <FaChevronRight size={12} className="text-zinc-500" />
                      </button>
                    )}

                  </nav>

                  {/* Cerrar Sesión */}
                  <button
                    onClick={() => {
                      onLogout();
                      setSidebarOpen(false);
                    }}
                    className="w-full text-center mt-6 py-3.5 px-4 rounded-2xl font-black text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 transition-colors uppercase text-xs tracking-widest cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <FaSignOutAlt size={14} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              ) : (
                /* ⚪ Vista: Sin Sesión */
                <div className="my-auto flex flex-col items-center text-center px-4 w-full">
                  <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-black mb-5 shadow-sm border border-zinc-200/60">
                    <FaUser size={24} />
                  </div>
                  <h3 className="text-3xl font-black text-black tracking-tight mb-1.5">
                    ¡Bienvenido!
                  </h3>
                  <p className="text-zinc-500 text-sm font-medium mb-8">
                    Inicia sesión para administrar.
                  </p>
                  <button
                    onClick={() => {
                      onLoginClick();
                      setSidebarOpen(false);
                    }}
                    className="w-full bg-black hover:bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg active:scale-95 cursor-pointer"
                  >
                    INICIAR SESIÓN
                  </button>
                </div>
              )}

              {/* 🏷️ Pie de página */}
              <div className="mt-auto pt-5 border-t border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-400 font-black tracking-widest uppercase">
                  CHEMA SPORT ER
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </header>
  );
}