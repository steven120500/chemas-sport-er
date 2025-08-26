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
  return (
    <header className="bg-white shadow-md px-4 sm:px-6 py-3 sm:py-4 relative">
      {/* Fila superior (siempre): logo izq, usuario der */}
      <div className="flex items-center justify-between">
        {/* Logo como botón */}
        <button
          onClick={onLogoClick}
          className="focus:outline-none bg-white"
          title="Volver al inicio"
        >
          <img src={logo} alt="Logo Chemas Sport" className="h-14 sm:h-20" />
        </button>

        {/* Botón de usuario o Login */}
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
              className="rounded-full p-3 shadow-lg transition text-white bg-black hover:bg-gray-800"
            >
              <FaUser size={18} />
            </button>
          )}
        </div>
      </div>

      
      {/* Título */}
      <div className="text-center">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
        ChemaSport ER
      </h1>
    </div>
    </header>
  );
}