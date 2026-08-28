import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import { FaUser } from "react-icons/fa";
import UserDropDown from "./UserDropDown";

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

  useEffect(() => {
    const interval = setInterval(() => {
      setIsDark((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // 🟢 Lista completa, eliminando "Todos" y empezando por "Temp 26-27"
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
          <button onClick={onLogoClick} className="focus:outline-none bg-transparent" title="Volver al inicio">
            <img src={logo} alt="Logo Chemas Sport" className="h-14 sm:h-16 transition-transform duration-700 hover:scale-105" />
          </button>

          <h1
            className={`absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-extrabold tracking-tight transition-colors duration-700 ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            ChemaSport ER
          </h1>

          <div className="flex items-center">
            {user ? (
              <UserDropDown
                isSuperUser={isSuperUser}
                onLogout={onLogout}
                onAddUser={() => setShowRegisterUserModal(true)}
                onViewUsers={() => setShowUserListModal(true)}
                onViewHistory={() => setShowHistoryModal(true)}
                canSeeHistory={user?.isSuperUser || user?.roles?.includes("history")}
              />
            ) : (
              <button
                onClick={onLoginClick}
                title="Iniciar sesión / Registrarse"
                className={`rounded-full p-3 shadow-lg transition-all duration-700 ${
                  isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                <FaUser size={18} />
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
              // Comprobación de estado activo exacta
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
    </header>
  );
}