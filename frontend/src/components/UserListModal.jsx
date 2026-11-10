// src/components/UserListModal.jsx
import React, { useEffect, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTrashAlt, FaUsers, FaUserSlash } from "react-icons/fa";
import ModalShell from "./ModalShell";

// ⚠️ Estilos en index.css (sección "MODALES", clases md-*).

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function UserListModal({ open, onClose, currentUser, token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let abort = false;

    (async () => {
      setLoading(true);
      try {
        const headers = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/auth/users`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!abort) setUsers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error al cargar usuarios:", e);
        if (!abort) toastHOT.error("No se pudieron cargar los usuarios");
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => { abort = true; };
  }, [open, token]);

  if (!open) return null;

  function askDeleteUser(user) {
    if (currentUser?._id === user._id) {
      toastHOT.error("No puedes eliminar tu propia cuenta.");
      return;
    }
    if (user.isSuperUser) {
      toastHOT.error("No puedes eliminar al superadmin.");
      return;
    }

    toastHOT((t) => (
      <div className="text-center p-1">
        <p className="font-black text-gray-800 mb-3">¿Eliminar a {user.username}?</p>
        <div className="mt-2 flex gap-2 justify-center">
          <button
            onClick={() => { toastHOT.dismiss(t.id); doDeleteUser(user._id); }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 uppercase tracking-wider"
          >
            Eliminar
          </button>
          <button
            onClick={() => toastHOT.dismiss(t.id)}
            className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 uppercase tracking-wider"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  }

  async function doDeleteUser(userId) {
    try {
      setLoading(true);
      const headers = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/auth/users/${userId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setUsers((prev) => prev.filter((u) => u._id !== userId));
      toastHOT.success("Usuario eliminado");
    } catch (e) {
      console.error("Error al eliminar usuario:", e);
      toastHOT.error("No se pudo eliminar el usuario");
    } finally {
      setLoading(false);
    }
  }

  const roleNames = {
    add: "Agregar",
    edit: "Editar",
    delete: "Eliminar",
    history: "Historial",
    ver_ocultos: "Ocultos",
    view_users: "Usuarios",
    tienda: "Tienda",
  };

  return (
    <ModalShell
      onClose={onClose}
      size="md"
      icon={FaUsers}
      eyebrow="Administración"
      title="Usuarios"
      subtitle={loading && !users.length ? "Cargando equipo…" : `${users.length} ${users.length === 1 ? "cuenta registrada" : "cuentas registradas"}`}
    >
      {loading && !users.length ? (
        <div className="md-list" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="md-skeleton" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="md-empty">
          <FaUserSlash size={22} />
          No hay usuarios registrados
        </div>
      ) : (
        <div className="md-list">
          {users.map((user) => {
            const rolesArray = user.isSuperUser
              ? ["Superadmin"]
              : (user.roles?.length ? user.roles : ["Sin permisos"]);

            const isSelf = currentUser?._id === user._id;
            const cannotDelete = isSelf || user.isSuperUser;

            return (
              <div key={user._id} className="md-user">
                <span className={`md-avatar ${user.isSuperUser ? "is-super" : isSelf ? "is-self" : ""}`} aria-hidden="true">
                  {(user.username || "?").charAt(0)}
                </span>

                <div className="md-user-info">
                  <div className="md-user-name">
                    <span>{user.username}</span>
                    {isSelf && <small>Tú</small>}
                  </div>

                  {/* 🔥 PASTILLAS DE ROLES 🔥 */}
                  <div className="md-chips">
                    {rolesArray.map((role, idx) => (
                      <span key={idx} className={`md-chip ${role === "Superadmin" ? "is-gold" : ""}`}>
                        {roleNames[role] || role}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 🔥 BOTÓN DE ELIMINAR 🔥 */}
                <button
                  type="button"
                  className="md-icon-btn"
                  disabled={cannotDelete || loading}
                  onClick={() => askDeleteUser(user)}
                  aria-label={`Eliminar a ${user.username}`}
                  title={
                    cannotDelete
                      ? isSelf
                        ? "No puedes eliminar tu propia cuenta"
                        : "No se puede eliminar al superadmin"
                      : "Eliminar usuario"
                  }
                >
                  <FaTrashAlt />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}
