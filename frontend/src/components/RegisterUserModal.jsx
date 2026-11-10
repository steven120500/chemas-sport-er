// src/components/RegisterUserModal.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash, FaUserPlus } from "react-icons/fa";
import ModalShell from "./ModalShell";

// ⚠️ Estilos en index.css (sección "MODALES", clases md-*).

export default function RegisterUserModal({ onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [roles, setRoles] = useState({
    add: false,
    edit: false,
    delete: false,
    history: false,
  });

  async function handleSubmit(e) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const selectedRoles = Object.entries(roles)
        .filter(([, value]) => value)
        .map(([key]) => key);

      const payload = { username, password, roles: selectedRoles };

      const res = await fetch(
        "https://chemas-sport-er-backend.onrender.com/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (res.ok) {
        toast.success("Usuario registrado correctamente");
        onClose?.();
      } else {
        toast.error(data.message || "Error al registrar usuario");
      }
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      toast.error("Error en el servidor");
    } finally {
      setSaving(false);
    }
  }

  const roleLabels = {
    add: "Agregar productos",
    edit: "Editar productos",
    delete: "Eliminar productos",
    history: "Ver historial",
  };

  const roleHints = {
    add: "Crear productos y usuarios",
    edit: "Cambiar precios, fotos e inventario",
    delete: "Borrar productos del catálogo",
    history: "Consultar la bitácora de acciones",
  };

  return (
    <ModalShell
      onClose={onClose}
      size="sm"
      icon={FaUserPlus}
      eyebrow="Administración"
      title="Nuevo usuario"
      subtitle="Creá un acceso y elegí qué puede hacer."
      footer={(close) => (
        <>
          <button type="button" className="md-btn is-flat" onClick={close}>
            Cancelar
          </button>
          <button type="submit" form="md-register-form" className="md-btn is-primary" disabled={saving}>
            {saving && <span className="md-spinner" aria-hidden="true" />}
            {saving ? "Registrando…" : "Registrar usuario"}
          </button>
        </>
      )}
    >
      <form id="md-register-form" onSubmit={handleSubmit} style={{ display: "contents" }}>
        <label className="md-field">
          <span className="md-label">Nombre de usuario</span>
          <input
            type="text"
            className="md-input"
            placeholder="Ej. ChemaSportER"
            autoComplete="off"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="md-field">
          <span className="md-label">Contraseña</span>
          <div className="md-affix is-pass">
            <input
              type={showPassword ? "text" : "password"}
              className="md-input"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="md-affix-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </label>

        {/* 🔥 PERMISOS 🔥 */}
        <div className="md-section">
          <span className="md-section-title">Permisos</span>
          {["add", "edit", "delete", "history"].map((perm) => (
            <label key={perm} className="md-switch">
              <span className="md-switch-text">
                <b>{roleLabels[perm]}</b>
                <small>{roleHints[perm]}</small>
              </span>
              <input
                type="checkbox"
                checked={roles[perm]}
                onChange={() => setRoles((prev) => ({ ...prev, [perm]: !prev[perm] }))}
              />
              <span className="md-track" />
            </label>
          ))}
        </div>
      </form>
    </ModalShell>
  );
}
