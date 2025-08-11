import logo from "../assets/logo.png";
import { FaUser } from "react-icons/fa";
import UserDropDown from "./UserDropDown";

export default function Header({
  onLoginClick,
  onLogout,
  user,
  canSeeHistory,
  isSuperUser,
  setShowRegisterUserModal,
  setShowUserListModal,
  setShowHistoryModal,
}) {
  return (
    <header className="bg-white shadow-md px-6 py-4 relative">
      <div className="flex items-center justify-between flex-wrap">
        {/* Logo */}
        <div className="flex items-center">
          <img
            src={logo}
            alt="Logo Chemas Sport"
            className="h-20 w-auto"
          />
        </div>

        {/* Título */}
        <div className="w-full mt-4 sm:mt-0 sm:w-auto text-center flex-grow">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            ChemaSport ER
          </h1>
        </div>

        {/* Botón de usuario o Login */}
        <div className="absolute top-6 right-6 flex flex-col gap-2 items-end">
          {user ? (
            <UserDropDown
              isSuperUser={isSuperUser}
              onLogout={onLogout}
              onAddUser={() => setShowRegisterUserModal(true)}
              onViewUsers={() => setShowUserListModal(true)}
              onViewHistory={() => setShowHistoryModal(true)}
              canSeeHistory={user?.isSuperUser || user?.roles?.includes('history')}
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
    </header>
  );
}