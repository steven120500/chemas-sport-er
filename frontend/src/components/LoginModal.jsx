import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';

// ⚠️ Estilos en index.css (sección "LOGIN", clases lg-*).

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!username || !password) {
      toast.warn('Todos los campos son requeridos', { style: { background: '#000', color: '#fff' } });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('https://chemas-sport-er-backend.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // El backend responde { message } en los errores
        throw new Error(data.message || data.error || 'Error al autenticar');
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
      toast.error(err.message || 'Error desconocido', { style: { background: '#000', color: '#fff' } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-layer" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
      <motion.div
        className="lg-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="lg-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      >
        <button type="button" className="lg-close" onClick={onClose} aria-label="Cerrar">
          <FaTimes />
        </button>

        <span className="lg-eyebrow">Panel de administración</span>
        <h2 className="lg-title">Iniciar sesión</h2>

        <form onSubmit={handleSubmit} className="lg-form">
          <label className="lg-field">
            <span>Usuario</span>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              placeholder="Tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="lg-field">
            <span>Contraseña</span>
            <div className="lg-pass">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="lg-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <button type="submit" className="lg-submit" disabled={loading}>
            {loading ? <span className="lg-spinner" aria-hidden="true" /> : null}
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button type="button" className="lg-cancel" onClick={onClose}>
            Cancelar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
