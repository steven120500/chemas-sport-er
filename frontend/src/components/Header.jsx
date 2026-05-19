// src/components/Header.jsx
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

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
  // 🟢 Estado que alterna entre blanco y negro
  const [isDark, setIsDark] = useState(false);

  // 🔁 Cambia cada 3 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setIsDark((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={`relative shadow-md px-2 sm:px-6 py-2 sm:py-6 overflow-hidden min-h-[260px] transition-all duration-1000 ${
        isDark ? "bg-black" : "bg-white"
      }`}
    >
      {/* Fondo decorativo opcional */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isDark ? "opacity-20" : "opacity-70"
        }`}
        style={{
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      ></div>

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
            className="h-14 sm:h-20 transition-transform duration-700 hover:scale-105"
          />
        </button>

        {/* Título centrado */}
        <h1
          className={`absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-extrabold tracking-tight transition-colors duration-700 ${
            isDark ? "text-white" : "text-black"
          }`}
        >
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
              className={`rounded-full p-3 shadow-lg transition-all duration-700 ${
                isDark
                  ? "bg-white text-black hover:bg-gray-200"
                  : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              <FaUser size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}