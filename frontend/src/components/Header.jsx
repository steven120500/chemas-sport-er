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
      className="relative shadow-xl px-4 sm:px-6 py-4 sm:py-6 overflow-hidden min-h-[220px] sm:min-h-[260px] animate-metal-shine flex items-start sm:items-center"
      style={{
        background: 'linear-gradient(110deg, #b8860b 0%, #e6be8a 25%, #f7e7ce 50%, #e6be8a 75%, #b8860b 100%)',
        backgroundSize: '200% auto',
      }}
    >
      <style>
        {`
          @keyframes metalShine {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
          .animate-metal-shine {
            animation: metalShine 8s linear infinite;
          }

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
            animation: shimmer 5s infinite;
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
            className="h-12 sm:h-20 transition-transform duration-300 hover:scale-110 drop-shadow-lg"
          />
        </button>

        {/* Título Centrado Absoluto (Funciona en PC y Celular) */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none px-4">
          <h1 className="text-xl sm:text-3xl font-black tracking-tighter text-black uppercase drop-shadow-md text-center pointer-events-auto">
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
              className="rounded-full p-2.5 sm:p-3 shadow-2xl transition-all duration-300 bg-black text-white hover:bg-zinc-900 border border-yellow-500/50"
            >
              <FaUser size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}