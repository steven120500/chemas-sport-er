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
        style: { background: '#111', color: '#fff' }
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
        style: { background: '#111', color: '#fff' }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      {/* Contenedor Principal Modo Halloween / Premium */}
      <div 
        className="relative bg-[#111] p-8 rounded-3xl shadow-[0_0_40px_rgba(234,179,8,0.15)] border border-yellow-500/30 w-full max-w-sm overflow-hidden"
      >
        {/* Telaraña Decorativa de Halloween */}
        <img 
          src="/Araña.png" 
          alt="Decoración Halloween" 
          className="absolute top-0 right-0 w-32 opacity-20 invert pointer-events-none transform rotate-90" 
        />

        <div className="relative z-10">
          <h2 className="text-2xl font-black mb-6 text-center tracking-widest uppercase text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2">
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
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3.5 rounded-xl text-black font-medium outline-none focus:border-yellow-500 transition-colors shadow-inner"
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
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3.5 rounded-xl text-black font-medium outline-none focus:border-yellow-500 transition-colors shadow-inner pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-[10px] font-black uppercase tracking-wider text-yellow-600 hover:text-yellow-400 bg-transparent transition-colors"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <button
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-2xl font-black tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-transform transform hover:-translate-y-1"
              >
                {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-transparent border-2 border-[#333] text-gray-400 hover:bg-[#1a1a1a] hover:text-white hover:border-gray-600 py-3.5 rounded-2xl font-bold tracking-widest uppercase transition-colors"
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