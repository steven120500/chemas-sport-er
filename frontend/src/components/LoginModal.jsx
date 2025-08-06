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
      toast.warn('Todos los campos son requeridos');
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
      toast.error(err.message || 'Error desconocido');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-center">
          {isRegister ? 'Registrarse' : 'Iniciar Sesión'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border border-gray-300 px-3 py-2 rounded"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 px-3 py-2 rounded w-full"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-600"
            >
              {showPassword ? 'No Mostrar' : 'Mostrar'}
            </button>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            {isRegister ? 'Registrarse' : 'Iniciar Sesión'}
          </button>

          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm underline text-center"
          >
            {isRegister
              ? '¿Ya tienes cuenta? Iniciar sesión'
              : '¿No tienes cuenta? Regístrate'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400 transition"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}