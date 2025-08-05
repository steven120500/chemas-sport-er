

import logo from '../assets/logo.png';
import { FaUser, FaUserPlus } from 'react-icons/fa';

export default function Header({ onLoginClick, user, isSuperUser, setShowRegisterUserModal }) {
  return (
    <header className="w-full bg-white shadow-sm px-6 py-4 mb-6 relative">
      {/* Logo + Título */}
      <div className="flex items-center justify-between flex-wrap">
        <div className="flex items-center">
          <img src={logo} alt="Logo Chemas Sport" className="h-20 w-auto" />
        </div>

        <div className="w-full mt-4 sm:mt-0 sm:w-auto text-center flex-grow">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">ChemaSport ER</h1>
        </div>
      </div>

      {/* Botones */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 items-end">
        {/* Botón añadir usuario - solo si es superadmin */}
        {isSuperUser && (
          <button
            className="bg-black text-white rounded-full p-2 flex items-center justify-center"
            onClick={() => setShowRegisterUserModal(true)}
            title="Añadir usuario"
          >
            <FaUserPlus size={18} />
          </button>
        )}

        {/* Botón de login / usuario */}
        <button
          onClick={!user ? onLoginClick : undefined}
          disabled={!!user}
          title={user ? `Usuario: ${user.username}` : 'Iniciar sesión / Registrarse'}
          className={`rounded-full p-3 shadow-lg transition text-white ${
            user
              ? 'bg-green-600 cursor-not-allowed'
              : 'bg-black hover:bg-gray-800 cursor-pointer'
          }`}
        >
          <FaUser size={18} />
        </button>
      </div>
    </header>
  );
}
