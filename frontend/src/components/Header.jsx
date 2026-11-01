import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { 
  FaUser, FaTimes, FaHistory, FaUserPlus, FaUsers, FaSignOutAlt, FaChevronRight,
  FaPercentage, FaTruck, FaStore
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  
  const scrollRef = useRef(null);
  const [isDraggingCSS, setIsDraggingCSS] = useState(false);
  
  // 🔥 ESTADO PARA LA ANIMACIÓN DEL FONDO Y LETRAS 🔥
  const [isLightMode, setIsLightMode] = useState(false);
  
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false); 
  
  const accumulator = useRef(0); 

  // 🔥 Efecto para alternar entre Blanco y Negro cada 4 segundos 🔥
  useEffect(() => {
    const interval = setInterval(() => {
      setIsLightMode((prev) => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Efecto del auto-scroll de las categorías
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationId;
    const scrollSpeed = 0.6;

    const autoScroll = () => {
      if (!isMouseDown.current) {
        accumulator.current += scrollSpeed;
        
        if (accumulator.current >= 1) {
          const pixelsToMove = Math.floor(accumulator.current);
          el.scrollLeft += pixelsToMove;
          accumulator.current -= pixelsToMove;
        }

        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(autoScroll);
    };

    animationId = requestAnimationFrame(autoScroll);
    return () => cancelAnimationFrame(animationId);
  }, []); 

  const handleStart = (e) => {
    isMouseDown.current = true;
    hasDragged.current = false; 
    
    const pageX = e.pageX || (e.touches && e.touches[0].pageX);
    if (!pageX) return;

    startX.current = pageX - scrollRef.current.offsetLeft;
    scrollLeftPos.current = scrollRef.current.scrollLeft;
  };

  const handleEnd = () => {
    isMouseDown.current = false;
    setIsDraggingCSS(false);
  };

  const handleMove = (e) => {
    if (!isMouseDown.current) return;
    
    const pageX = e.pageX || (e.touches && e.touches[0].pageX);
    if (!pageX) return;

    const x = pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    
    if (Math.abs(walk) > 3) {
      hasDragged.current = true;
      setIsDraggingCSS(true);
    }
    
    scrollRef.current.scrollLeft = scrollLeftPos.current - walk;
  };

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
    { label: "LLAVEROS", value: "Llaveros" }, 
    { label: "NBA", value: "NBA" },
    { label: "MLB", value: "MLB" },
    { label: "NFL", value: "NFL" },
    { label: "F1", value: "F1" }, 
  ];

  // IDENTIFICAR SI ES EL USUARIO "TIENDA" O SUPER ADMIN
  const usernameLower = String(user?.username || user?.name || user?.firstName || "").trim().toLowerCase();
  const esSoloUsuarioTienda = !isSuperUser && (
    usernameLower === "tienda" || 
    usernameLower.includes("tienda") || 
    user?.role === "tienda" || 
    user?.rol === "tienda" ||
    user?.roles?.includes("tienda")
  );
  const esAdminTienda = isSuperUser || esSoloUsuarioTienda;

  return (
    <header
      className={`sticky top-0 z-50 w-full shadow-md border-none transition-colors duration-1000 ${
        isLightMode ? "bg-white" : "bg-black"
      }`}
    >
      <div className="relative px-2 sm:px-6 py-2 sm:py-4">
        {/* Capa sutil de fondo */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundSize: "cover", backgroundPosition: "center" }}
        ></div>

        <div className="relative z-10 flex items-center justify-between w-full">
          <button onClick={onLogoClick} className="focus:outline-none bg-transparent cursor-pointer" title="Volver al inicio">
            {/* 🔥 Logo: Se invierte el color cuando el fondo es blanco 🔥 */}
            <img 
              src={logo} 
              alt="Logo Chemas Sport" 
              className={`h-14 sm:h-16 transition-all duration-1000 hover:scale-105 ${
                isLightMode ? "invert brightness-0" : ""
              }`} 
            />
          </button>

          {/* 🔥 Letras del título limpias, cambiando solo de color 🔥 */}
          <h1
            className={`absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-extrabold tracking-tight transition-colors duration-1000 ${
              isLightMode ? "text-black" : "text-white"
            }`}
          >
            ChemaSport ER
          </h1>

          <div className="flex items-center min-w-[44px] justify-end">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title={user ? "Menú de usuario" : "Iniciar sesión"}
                className={`rounded-full p-3 shadow-lg transition-all duration-1000 cursor-pointer border ${
                  isLightMode 
                    ? "bg-gray-100 border-gray-300 text-black hover:border-black" 
                    : "bg-black border-zinc-700 text-white hover:border-gray-500"
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

      {/* 🔥 Divisor inferior del header animado 🔥 */}
      <div className={`w-full border-t overflow-hidden transition-colors duration-1000 ${
        isLightMode ? "border-gray-200" : "border-zinc-800"
      }`}>
        <div className="w-full relative">
          <nav 
            ref={scrollRef}
            onMouseDown={handleStart}
            onMouseLeave={handleEnd}
            onMouseUp={handleEnd}
            onMouseMove={handleMove}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            onTouchCancel={handleEnd}
            onTouchMove={handleMove}
            className={`flex items-center gap-6 sm:gap-8 py-2.5 sm:py-3.5 px-4 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-none ${isDraggingCSS ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {[...navItems, ...navItems].map((item, index) => {
              const isActive = filterType === item.value;
              
              return (
                <button
                  key={index}
                  onClick={(e) => {
                     if (!hasDragged.current) {
                       if (setFilterType) setFilterType(item.value);
                     }
                  }}
                  className={`group relative flex items-center text-[11px] sm:text-xs lg:text-[13px] font-black uppercase tracking-[0.1em] transition-colors duration-1000 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 py-1 z-20 shrink-0 cursor-pointer ${
                    isActive 
                      ? (isLightMode ? "text-black" : "text-white") 
                      : (isLightMode ? "text-gray-500 hover:text-black" : "text-gray-500 hover:text-white")
                  }`}
                >
                  {item.label}
                  
                  {/* 🔥 Línea indicadora inferior animada 🔥 */}
                  <span 
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-1000 ${
                      isActive 
                        ? `w-full ${isLightMode ? "bg-black shadow-[0_0_8px_rgba(0,0,0,0.4)]" : "bg-white shadow-[0_0_8px_#ffffff]"}` 
                        : `w-0 group-hover:w-full ${isLightMode ? "bg-gray-400" : "bg-white"}`
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="fixed top-0 right-0 h-full w-80 sm:w-88 shadow-[-10px_0_30px_rgba(0,0,0,0.8)] animate-in slide-in-from-right duration-300 border-l border-[#222]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar en modo oscuro premium (Este se mantiene oscuro por estética) */}
            <div className="relative h-full flex flex-col justify-between p-6 sm:p-7 text-white font-sans" style={{ backgroundColor: '#0a0a0a' }}>
              
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white hover:bg-[#111] rounded-full transition-colors cursor-pointer z-10 bg-transparent border-0"
                title="Cerrar"
              >
                <FaTimes size={20} />
              </button>

              {user ? (
                <div className="mt-8 flex-grow overflow-y-auto pr-1">
                  
                  <div className="mb-6 p-4 rounded-2xl bg-[#111] border border-[#222] flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center font-black text-sm shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                      {getInitials(user.firstName || user.username || user.name)}
                    </div>
                    <div className="overflow-hidden min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Sesión Activa
                      </span>
                      <p className="text-white font-black text-lg leading-tight truncate">
                        {user.firstName || user.username || user.name}
                      </p>
                    </div>
                  </div>

                  <nav className="space-y-2.5">
                    
                    {esAdminTienda && (
                      <button
                        onClick={() => {
                          navigate('/tienda');
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-white/5 border border-white/20 hover:border-white/40 hover:bg-white/10 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <FaStore size={15} className="text-white transition-colors" />
                          <span className="group-hover:text-gray-200 transition-colors">Tienda Física</span>
                        </div>
                        <FaChevronRight size={12} className="text-gray-400 group-hover:text-white transition-colors" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        navigate('/comisiones');
                        setSidebarOpen(false);
                      }}
                      className="w-full bg-[#111] border border-[#222] hover:border-white hover:bg-[#1a1a1a] text-gray-200 font-bold text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                    >
                      <div className="flex items-center gap-3">
                        <FaPercentage size={15} className="text-white transition-colors" />
                        <span className="group-hover:text-white transition-colors">Comisiones</span>
                      </div>
                      <FaChevronRight size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                    </button>

                    <button
                      onClick={() => {
                        navigate('/guias');
                        setSidebarOpen(false);
                      }}
                      className="w-full bg-[#111] border border-[#222] hover:border-white hover:bg-[#1a1a1a] text-gray-200 font-bold text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                    >
                      <div className="flex items-center gap-3">
                        <FaTruck size={15} className="text-white transition-colors" />
                        <span className="group-hover:text-white transition-colors">Guías</span>
                      </div>
                      <FaChevronRight size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                    </button>

                    {!esSoloUsuarioTienda && (
                      <>
                        {(isSuperUser || user?.roles?.includes("add")) && (
                          <button
                            onClick={() => {
                              setShowRegisterUserModal(true);
                              setSidebarOpen(false);
                            }}
                            className="w-full bg-[#111] border border-[#222] hover:border-white hover:bg-[#1a1a1a] text-gray-200 font-bold text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                          >
                            <div className="flex items-center gap-3">
                              <FaUserPlus size={16} className="text-white transition-colors" />
                              <span className="group-hover:text-white transition-colors">Agregar usuario</span>
                            </div>
                            <FaChevronRight size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                          </button>
                        )}

                        {(isSuperUser || user?.roles?.includes("view_users")) && (
                          <button
                            onClick={() => {
                              setShowUserListModal(true);
                              setSidebarOpen(false);
                            }}
                            className="w-full bg-[#111] border border-[#222] hover:border-white hover:bg-[#1a1a1a] text-gray-200 font-bold text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                          >
                            <div className="flex items-center gap-3">
                              <FaUsers size={16} className="text-white transition-colors" />
                              <span className="group-hover:text-white transition-colors">Ver usuarios</span>
                            </div>
                            <FaChevronRight size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                          </button>
                        )}
                      </>
                    )}

                    {(isSuperUser || esSoloUsuarioTienda || canSeeHistory || user?.roles?.includes("history")) && (
                      <button
                        onClick={() => {
                          setShowHistoryModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-[#111] border border-[#222] hover:border-white hover:bg-[#1a1a1a] text-gray-200 font-bold text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <FaHistory size={15} className="text-white transition-colors" />
                          <span className="group-hover:text-white transition-colors">Historial</span>
                        </div>
                        <FaChevronRight size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                      </button>
                    )}

                  </nav>

                  <button
                    onClick={() => {
                      onLogout();
                      setSidebarOpen(false);
                    }}
                    className="w-full text-center mt-6 py-3.5 px-4 rounded-2xl font-black text-red-500 bg-red-950/20 hover:bg-red-900 hover:text-white border border-red-900/50 transition-colors uppercase text-xs tracking-widest cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <FaSignOutAlt size={14} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              ) : (
                <div className="my-auto flex flex-col items-center text-center px-4 w-full">
                  <div className="w-16 h-16 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-white mb-5 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    <FaUser size={24} />
                  </div>
                  <h3 className="text-3xl font-black text-white tracking-tight mb-1.5">
                    ¡Bienvenido!
                  </h3>
                  <p className="text-gray-400 text-sm font-medium mb-8">
                    Inicia sesión para administrar.
                  </p>
                  <button
                    onClick={() => {
                      onLoginClick();
                      setSidebarOpen(false);
                    }}
                    className="w-full bg-white hover:bg-gray-200 text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors shadow-[0_5px_15px_rgba(255,255,255,0.2)] active:scale-95 cursor-pointer"
                  >
                    INICIAR SESIÓN
                  </button>
                </div>
              )}

              <div className="mt-auto pt-5 border-t border-[#222] text-center">
                <p className="text-[10px] text-gray-500 font-black tracking-widest uppercase">
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