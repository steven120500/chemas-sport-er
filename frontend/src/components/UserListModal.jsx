// src/components/UserListModal.jsx
import React, { useEffect, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaTrashAlt } from "react-icons/fa"; // ⭐ Iconos añadidos

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function UserListModal({ open, onClose, currentUser, token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Bloquear el scroll de fondo cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      
      {/* 🔥 FONDO DIFUMINADO PREMIUM 🔥 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* 🔥 CAJA DEL MODAL 🔥 */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col z-10 animate-fade-in-up overflow-hidden" style={{ maxHeight: '85vh' }}>
        
        {/* 🔥 BOTÓN DE CERRAR 🔥 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors"
          title="Cerrar"
        >
          <FaTimes size={18} />
        </button>

        {/* 🔥 ENCABEZADO ELITE 🔥 */}
        <div className="flex-none px-6 pt-8 pb-4 sm:px-8 text-center">
          <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-3 shadow-sm">
            Administración
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">
            Usuarios
          </h2>
        </div>

        {/* 🔥 BODY SCROLLABLE 🔥 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 px-6 sm:px-8 pb-8 pt-2 min-h-0">
          {loading ? (
            <p className="text-gray-400 font-bold text-center py-10 uppercase tracking-widest text-xs">Cargando equipo...</p>
          ) : (
            <div className="space-y-4">
              {users.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay usuarios registrados.</p>
                </div>
              ) : (
                users.map((user) => {
                  const rolesArray = user.isSuperUser 
                    ? ["Superadmin"] 
                    : (user.roles?.length ? user.roles : ["Cliente"]);

                  const isSelf = currentUser?._id === user._id;
                  const cannotDelete = isSelf || user.isSuperUser;

                  return (
                    <div key={user._id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between gap-4 transition-all hover:shadow-md">
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-gray-900 text-lg truncate">
                          {user.username} {isSelf && <span className="text-xs font-bold text-purple-600 ml-1">(Tú)</span>}
                        </div>
                        
                        {/* 🔥 PASTILLAS DE ROLES 🔥 */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rolesArray.map((role, idx) => (
                            <span 
                              key={idx} 
                              className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                                role === 'Superadmin' 
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                  : 'bg-gray-100 text-gray-500 border border-gray-200'
                              }`}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 🔥 BOTÓN DE ELIMINAR 🔥 */}
                      <button
                        disabled={cannotDelete || loading}
                        onClick={() => askDeleteUser(user)}
                        className={`flex items-center justify-center p-3 rounded-xl transition-colors shrink-0 ${
                          cannotDelete
                            ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                            : "bg-red-50 text-red-500 hover:bg-red-600 hover:text-white"
                        }`}
                        title={
                          cannotDelete
                            ? isSelf
                              ? "No puedes eliminar tu propia cuenta"
                              : "No se puede eliminar al superadmin"
                            : "Eliminar usuario"
                        }
                      >
                        <FaTrashAlt size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🔥 ANIMACIÓN DE ENTRADA 🔥 */}
      <style>{`
        @keyframes fadeInUpModal {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}