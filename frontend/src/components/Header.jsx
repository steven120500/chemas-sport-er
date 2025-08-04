import logo from '../assets/logo.png';
import { FaUser } from 'react-icons/fa';

export default function Header({ onLoginClick, user, isSuperUser }) {
  return (
    <header className="w-full bg-white shadow-sm px-6 py-4 mb-6 relative">
      <div className="flex items-center justify-between flex-wrap">
        {/* Logo a la izquierda */}
        <div className="flex items-center">
          <img src={logo} alt="Logo Chemas Sport" className="h-20 w-auto" />
        </div>

        {/* Título en el centro */}
        <div className="w-full mt-4 sm:mt-0 sm:w-auto text-center flex-grow">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            ChemaSport ER
          </h1>
        </div>
        
        
        {isSuperUser && (
  <button
    className="ml-2 bg-black text-white rounded-full p-2 flex items-center justify-center"
    onClick={() => setShowRegisterModal(true)}
    title="Añadir usuario"
  >
    <FaUserPlus size={20} />
  </button>
)}

       {/* Botón de usuario */}
<div className="absolute top-6 right-6">
  <button
    onClick={onLoginClick}
    className="bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition"
    title={user ? `Usuario: ${user.username}` : 'Iniciar sesión / Registrarse'}
  >
            <FaUser />
          </button>
        </div>
      </div>
    </header>
  );
}
