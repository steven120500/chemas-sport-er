import { useState } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.warn('Todos los campos son requeridos', {
        style: { background: '#000', color: '#fff' }
      });
      return;
    }

    const endpoint = isRegister ? 'register' : 'login';

    try {
      const res = await fetch(`https://chemas-sport-er-backend.onrender.com/api/auth/${endpoint}`,{
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al autenticar');
      }

      const userData = {
        username: data.username,
        roles: data.roles,
        isSuperUser: data.isSuperUser,
      };

      localStorage.setItem('user', JSON.stringify(userData));
      onLoginSuccess(userData);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error desconocido', {
        style: { background: '#000', color: '#fff' }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      {/* Contenedor Principal Minimalista Blanco y Negro */}
      <div 
        className="relative bg-white p-8 rounded-3xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden text-black"
      >
        <div className="relative z-10">
          <h2 className="text-2xl font-black mb-6 text-center tracking-widest uppercase text-black flex items-center justify-center gap-2">
            <span></span> {isRegister ? 'Registrarse' : 'Ingresar'} <span></span>
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div className="relative">
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 ml-1">
                Usuario
              </label>
              <input
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 px-4 py-3.5 rounded-xl text-black placeholder-gray-400 font-medium outline-none focus:border-black focus:bg-white transition-colors shadow-inner"
              />
            </div>

            <div className="relative">
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 ml-1">
                Contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 px-4 py-3.5 rounded-xl text-black placeholder-gray-400 font-medium outline-none focus:border-black focus:bg-white transition-colors shadow-inner pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-black bg-transparent transition-colors cursor-pointer"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <button
                type="submit"
                className="w-full bg-black hover:bg-zinc-800 text-white py-4 rounded-2xl font-black tracking-widest uppercase shadow-md transition-transform transform hover:-translate-y-0.5 cursor-pointer"
              >
                {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-black hover:border-black py-3.5 rounded-2xl font-bold tracking-widest uppercase transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}