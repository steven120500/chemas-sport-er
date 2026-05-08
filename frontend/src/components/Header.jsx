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
}) {
  return (
    <header
      className="relative shadow-xl px-2 sm:px-6 py-2 sm:py-6 overflow-hidden min-h-[260px] animate-metal-shine"
      style={{
        background: 'linear-gradient(110deg, #b8860b 0%, #e6be8a 25%, #f7e7ce 50%, #e6be8a 75%, #b8860b 100%)',
        backgroundSize: '200% auto',
      }}
    >
      <style>
        {`
          /* Animación de reflejo metálico en el fondo */
          @keyframes metalShine {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
          .animate-metal-shine {
            animation: metalShine 8s linear infinite;
          }

          /* Efecto de destello de luz cruzando el header */
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

      {/* Contenido principal */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Logo clickeable */}
        <button
          onClick={onLogoClick}
          className="focus:outline-none bg-transparent"
          title="Volver al inicio"
        >
          <img
            src={logo}
            alt="Logo Chemas Sport"
            className="h-14 sm:h-20 transition-transform duration-300 hover:scale-110 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]"
          />
        </button>

        {/* Título centrado */}
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-black tracking-tighter text-black uppercase drop-shadow-md">
          ChemaSport ER
        </h1>

        {/* Usuario o botón de Login */}
        <div className="flex items-center">
          {user ? (
            <UserDropDown
              isSuperUser={isSuperUser}
              onLogout={onLogout}
              onAddUser={() => setShowRegisterUserModal(true)}
              onViewUsers={() => setShowUserListModal(true)}
              onViewHistory={() => setShowHistoryModal(true)}
              canSeeHistory={
                user?.isSuperUser || user?.roles?.includes("history")
              }
            />
          ) : (
            <button
              onClick={onLoginClick}
              title="Iniciar sesión / Registrarse"
              className="rounded-full p-3 shadow-2xl transition-all duration-300 bg-black text-white hover:bg-zinc-900 border border-yellow-500/50"
            >
              <FaUser size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}