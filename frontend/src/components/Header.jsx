// src/components/Header.jsx
import logo from "../assets/logo.png";
import fondoHeader from "../assets/FondoHeader.png"; // ✅ imagen de fondo
import { FaUser } from "react-icons/fa";
import UserDropDown from "./UserDropDown";

export default function Header({
  onLoginClick,
  onLogout,
  onLogoClick, // callback para volver al inicio
  user,
  canSeeHistory,
  isSuperUser,
  setShowRegisterUserModal,
  setShowUserListModal,
  setShowHistoryModal,
}) {
  return (
    <header
      className="relative bg-white shadow-md px-2 sm:px-6 py-8 sm:py-32 overflow-hidden min-h-[260px]"
    >
      {/* 🖼️ Imagen de fondo responsive */}
      <img
        src={fondoHeader}
        alt="Fondo del header"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Capa blanca semitransparente para legibilidad */}
      <div className="absolute inset-0 bg-white/85"></div>

      {/* Contenido principal del header */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Fila superior (logo izq, usuario der) */}
        <div className="flex items-center justify-between">
          {/* Logo clickeable */}
          <button
            onClick={onLogoClick}
            className="focus:outline-none bg-transparent"
            title="Volver al inicio"
          >
            <img src={logo} alt="Logo Chemas Sport" className="h-14 sm:h-20" />
          </button>

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
                className="rounded-full p-3 shadow-lg transition text-white bg-purple-600 hover:bg-gray-800"
              >
                <FaUser size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Título central */}
        <div className="text-center mt-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            
          </h1>
        </div>
      </div>
    </header>
  );
}
