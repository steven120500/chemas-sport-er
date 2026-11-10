import { useState } from 'react';
import { toast } from 'react-toastify';
import { FaEye, FaEyeSlash, FaLock } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';
import ModalShell from './ModalShell';

// ⚠️ Estilos en index.css (sección "MODALES", clases md-*). Escape lo maneja ModalShell.

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
        token: data.token, // JWT: lo agrega authFetch a cada petición al backend
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
    <ModalShell
      onClose={onClose}
      size="sm"
      icon={FaLock}
      eyebrow="Panel de administración"
      title="Iniciar sesión"
      footer={(close) => (
        <>
          <button type="button" className="md-btn is-flat" onClick={close}>
            Cancelar
          </button>
          <button type="submit" form="md-login-form" className="md-btn is-primary" disabled={loading}>
            {loading && <span className="md-spinner" aria-hidden="true" />}
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </>
      )}
    >
      <form id="md-login-form" onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <label className="md-field">
          <span className="md-label">Usuario</span>
          <input
            type="text"
            className="md-input"
            autoFocus
            autoComplete="username"
            placeholder="Tu usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="md-field">
          <span className="md-label">Contraseña</span>
          <div className="md-affix is-pass">
            <input
              type={showPassword ? 'text' : 'password'}
              className="md-input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="md-affix-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </label>
        {/* 👈 Enter envía el formulario aunque el botón esté en el pie */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ModalShell>
  );
}
