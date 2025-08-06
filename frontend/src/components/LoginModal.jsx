import { useState } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !password) {
      toast.warn('Todos los campos son requeridos');
      return;
    }

    if (!emailRegex.test(email)) {
      toast.warn('Correo inválido');
      return;
    }

    const endpoint = isRegister ? 'register' : 'login';

    try {
      const response = await fetch(`https://chemas-sport-er-backend.onrender.com/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Error al iniciar sesión');
        return;
      }

      toast.success(data.message || 'Autenticación exitosa');
      onLoginSuccess(data.user); // Puedes ajustar según cómo manejes el usuario
      onClose();
    } catch (error) {
      console.error('Error en login:', error);
      toast.error('Ocurrió un error al iniciar sesión');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">{isRegister ? 'Registrar usuario' : 'Iniciar sesión'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded"
          />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded"
          />
          <div className="flex items-center justify-between">
            <label className="text-sm">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
              />{' '}
              Mostrar contraseña
            </label>
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-blue-500 text-sm underline"
            >
              {isRegister ? 'Ya tengo cuenta' : 'Crear cuenta'}
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-400 text-white rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {isRegister ? 'Registrar' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}