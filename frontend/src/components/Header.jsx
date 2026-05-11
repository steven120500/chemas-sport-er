import logo from "../assets/logo.png";
import { FaUser } from "react-icons/fa";
import UserDropDown from "./UserDropDown";

export default function Header({
  onLoginClick,
  onLogout,
  onLogoClick, 
  user,
  isSuperUser,
  setShowRegisterUserModal,
  setShowUserListModal,
  setShowHistoryModal,
}) {
  return (
    <header
      className="relative shadow-xl px-4 sm:px-6 py-4 sm:py-6 overflow-hidden min-h-[220px] sm:min-h-[260px] animate-smooth-color-cycle flex items-start sm:items-center"
    >
      <style>
        {`
          /* 🔥 ANIMACIÓN DE 4 COLORES CON TRANSICIÓN SUAVE 🔥 */
          @keyframes smoothColorCycle {
            /* Mantiene el Celeste y luego transiciona */
            0%, 15%  { background-color: #0e77c8; } 
            
            /* Llega a Verde, se mantiene y luego transiciona */
            25%, 40% { background-color: #0a9434; } 
            
            /* Llega a Rojo, se mantiene y luego transiciona */
            50%, 65% { background-color: #7b1f09; } 
            
            /* Llega a Negro, se mantiene y luego transiciona */
            75%, 90% { background-color: #000000; } 
            
            /* Regresa suavemente al Celeste para cerrar el ciclo sin cortes */
            100%     { background-color: #0e77c8; } 
          }

          .animate-smooth-color-cycle {
            /* Ciclo de 20s en total usando ease-in-out para que el difuminado sea natural */
            animation: smoothColorCycle 20s ease-in-out infinite; 
            background-color: #000000; /* Color base por defecto */
          }

          /* Efecto de destello de luz sutil cruzando el header */
          .shimmer-overlay::after {
            content: "";
            position: absolute;
            top: 0;
            left: -150%;
            width: 50%;
            height: 100%;
            background: linear-gradient(
              to right,
              transparent,
              rgba(255, 255, 255, 0.4),
              transparent
            );
            transform: skewX(-25deg);
            animation: shimmer 6s infinite;
          }

          @keyframes shimmer {
            0% { left: -150%; }
            30% { left: 150%; }
            100% { left: 150%; }
          }
        `}
      </style>

      {/* Capa de destello animado */}
      <div className="absolute inset-0 shimmer-overlay pointer-events-none"></div>

      {/* Contenedor Principal con Iconos en los extremos */}
      <div className="relative z-20 flex items-center justify-between w-full h-fit">
        {/* Logo a la Izquierda */}
        <button
          onClick={onLogoClick}
          className="focus:outline-none bg-transparent"
        >
          <img
            src={logo}
            alt="Logo Chemas Sport"
            className="h-12 sm:h-20 transition-transform duration-300 hover:scale-110 drop-shadow-md" 
          />
        </button>

        {/* Título Centrado Absoluto */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none px-4">
          {/* 🔥 TÍTULO SIEMPRE BLANCO CON SOMBRA 🔥 */}
          <h1 className="text-xl sm:text-3xl font-black tracking-tighter uppercase text-center pointer-events-auto text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            ChemaSport ER
          </h1>
        </div>

        {/* Botón Usuario / Dropdown a la Derecha */}
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
              className="rounded-full p-2.5 sm:p-3 shadow-xl transition-all duration-300 bg-white text-black hover:bg-zinc-200 border-none"
            >
              <FaUser size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}