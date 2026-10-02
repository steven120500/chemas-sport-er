import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { 
  FaUser, FaTimes, FaHistory, FaUserPlus, FaUsers, FaSignOutAlt, FaChevronRight,
  FaPercentage
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
  
  const scrollRef = useRef(null);
  const [isDraggingCSS, setIsDraggingCSS] = useState(false);
  
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false); 
  
  const accumulator = useRef(0); 

  useEffect(() => {
    const interval = setInterval(() => {
      setIsDark((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-1000 shadow-md ${
        isDark ? "bg-black" : "bg-white"
      }`}
    >
    

      <div className="relative px-2 sm:px-6 py-2 sm:py-4">
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            isDark ? "opacity-20" : "opacity-70"
          }`}
          style={{ backgroundSize: "cover", backgroundPosition: "center" }}
        ></div>

        <div className="relative z-10 flex items-center justify-between w-full">
          <button onClick={onLogoClick} className="focus:outline-none bg-transparent cursor-pointer" title="Volver al inicio">
            <img src={logo} alt="Logo Chemas Sport" className="h-14 sm:h-16 transition-transform duration-700 hover:scale-105" />
          </button>

          <h1
            className={`absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-extrabold tracking-tight transition-colors duration-700 ${
              isDark ? "text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" : "text-black"
            }`}
          >
            ChemaSport ER
          </h1>

          <div className="flex items-center min-w-[44px] justify-end">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title={user ? "Menú de usuario" : "Iniciar sesión"}
                className={`rounded-full p-3 shadow-lg transition-all duration-300 cursor-pointer ${
                  isDark ? "bg-yellow-600 text-white hover:bg-yellow-700" : "bg-black text-white hover:bg-gray-800"
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

      <div className={`w-full border-t transition-colors duration-1000 overflow-hidden ${
        isDark ? "border-yellow-900" : "border-gray-100/50"
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
                  className={`group relative flex items-center text-[11px] sm:text-xs lg:text-[13px] font-black uppercase tracking-[0.1em] transition-all duration-300 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 py-1 z-20 shrink-0 ${
                    isActive 
                      ? (isDark ? "text-yellow-500 drop-shadow-[0_0_5px_#ca8a04]" : "text-yellow-600") 
                      : (isDark ? "text-gray-400 hover:text-yellow-400" : "text-gray-400 hover:text-yellow-500")
                  } cursor-pointer`}
                >
                  {item.label}
                  
                  <span 
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ${
                      isActive 
                        ? `w-full ${isDark ? "bg-yellow-500 shadow-[0_0_8px_#ca8a04]" : "bg-yellow-600"}` 
                        : `w-0 group-hover:w-full ${isDark ? "bg-yellow-900" : "bg-yellow-200"}`
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="fixed top-0 right-0 h-full w-80 sm:w-88 shadow-[0_0_30px_rgba(202,138,4,0.3)] animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-white h-full flex flex-col justify-between p-6 sm:p-7 text-black font-sans">
              
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-5 right-5 p-1 text-black hover:text-yellow-600 transition-colors cursor-pointer z-10 bg-transparent border-0"
                title="Cerrar"
              >
                <FaTimes size={20} />
              </button>

              {user ? (
                <div className="mt-8 flex-grow overflow-y-auto pr-1">
                  
                  <div className="mb-6 p-4 rounded-2xl bg-yellow-50 border border-yellow-200 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-yellow-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-[0_0_10px_rgba(202,138,4,0.4)]">
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

                  <nav className="space-y-2.5">
                    
                    <button
                      onClick={() => {
                        navigate('/comisiones');
                        setSidebarOpen(false);
                      }}
                      className="w-full bg-black hover:bg-yellow-600 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                    >
                      <div className="flex items-center gap-3">
                        <FaPercentage size={15} className="text-yellow-500 group-hover:text-white transition-colors" />
                        <span>Comisiones</span>
                      </div>
                      <FaChevronRight size={12} className="text-yellow-700 group-hover:text-white transition-colors" />
                    </button>

                    {(isSuperUser || canSeeHistory || user?.roles?.includes("add")) && (
                      <button
                        onClick={() => {
                          setShowRegisterUserModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-black hover:bg-yellow-600 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <FaUserPlus size={16} className="text-yellow-500 group-hover:text-white transition-colors" />
                          <span>Agregar usuario</span>
                        </div>
                        <FaChevronRight size={12} className="text-yellow-700 group-hover:text-white transition-colors" />
                      </button>
                    )}

                    {(isSuperUser || canSeeHistory || user?.roles?.includes("view_users")) && (
                      <button
                        onClick={() => {
                          setShowUserListModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-black hover:bg-yellow-600 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <FaUsers size={16} className="text-yellow-500 group-hover:text-white transition-colors" />
                          <span>Ver usuarios</span>
                        </div>
                        <FaChevronRight size={12} className="text-yellow-700 group-hover:text-white transition-colors" />
                      </button>
                    )}

                    {(isSuperUser || canSeeHistory || user?.roles?.includes("history")) && (
                      <button
                        onClick={() => {
                          setShowHistoryModal(true);
                          setSidebarOpen(false);
                        }}
                        className="w-full bg-black hover:bg-yellow-600 text-white font-bold text-left px-5 py-3.5 rounded-2xl transition-colors flex items-center justify-between shadow-sm cursor-pointer text-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <FaHistory size={15} className="text-yellow-500 group-hover:text-white transition-colors" />
                          <span>Historial</span>
                        </div>
                        <FaChevronRight size={12} className="text-yellow-700 group-hover:text-white transition-colors" />
                      </button>
                    )}

                  </nav>

                  <button
                    onClick={() => {
                      onLogout();
                      setSidebarOpen(false);
                    }}
                    className="w-full text-center mt-6 py-3.5 px-4 rounded-2xl font-black text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 transition-colors uppercase text-xs tracking-widest cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <FaSignOutAlt size={14} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              ) : (
                <div className="my-auto flex flex-col items-center text-center px-4 w-full">
                  <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 mb-5 shadow-sm border border-yellow-200">
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
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors shadow-[0_5px_15px_rgba(202,138,4,0.4)] active:scale-95 cursor-pointer"
                  >
                    INICIAR SESIÓN
                  </button>
                </div>
              )}

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