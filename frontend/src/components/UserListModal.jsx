// src/components/UserListModal.jsx
import React, { useEffect, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";

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
    // No permitir borrar al actual o superadmin
    if (currentUser?._id === user._id) {
      toastHOT.error("No puedes eliminar tu propia cuenta.");
      return;
    }
    if (user.isSuperUser) {
      toastHOT.error("No puedes eliminar al superadmin.");
      return;
    }

    toastHOT((t) => (
      <span>
        <p>¿Eliminar a <b>{user.username}</b>?</p>
        <div className="mt-2 flex gap-2 justify-end">
          <button
            onClick={() => { toastHOT.dismiss(t.id); doDeleteUser(user._id); }}
            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Sí
          </button>
          <button
            onClick={() => toastHOT.dismiss(t.id)}
            className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
          >
            No
          </button>
        </div>
      </span>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* Card */}
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold">Usuarios registrados</h2>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
          >
            Cerrar
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <p className="text-gray-600">Cargando usuarios...</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {users.length === 0 ? (
              <li>No hay usuarios registrados.</li>
            ) : users.map((user) => {
              const rolesStr = user.isSuperUser
                ? "Superadmin"
                : (user.roles || []).join(", ") || "Cliente";

              const isSelf = currentUser?._id === user._id;
              const cannotDelete = isSelf || user.isSuperUser;

              return (
                <li key={user._id} className="border-b pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{user.username}</div>
                      <div className="text-sm text-gray-600">Rol: {rolesStr}</div>
                    </div>
                    <button
                      disabled={cannotDelete || loading}
                      onClick={() => askDeleteUser(user)}
                      className={`px-3 py-1 text-sm rounded ${
                        cannotDelete
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                      title={
                        cannotDelete
                          ? isSelf
                            ? "No puedes eliminar tu propia cuenta"
                            : "No se puede eliminar al superadmin"
                          : "Eliminar usuario"
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}