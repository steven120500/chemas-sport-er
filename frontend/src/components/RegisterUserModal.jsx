// src/components/RegisterUserModal.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaTimes, FaEye, FaEyeSlash } from "react-icons/fa"; // ⭐ Agregamos los íconos del ojo

export default function RegisterUserModal({ onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [roles, setRoles] = useState({
    add: false,
    edit: false,
    delete: false,
    history: false,
  });

  // Bloquear el scroll de la página de fondo
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  async function handleSubmit() {
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
    }
  }

  const roleLabels = {
    add: "Agregar productos",
    edit: "Editar productos",
    delete: "Eliminar productos",
    history: "Ver historial",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* 🔥 FONDO DIFUMINADO PREMIUM 🔥 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* 🔥 CAJA DEL MODAL 🔥 */}
      <div className="relative bg-white p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full flex flex-col z-10 animate-fade-in-up">
        
        {/* 🔥 BOTÓN DE CERRAR 🔥 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors"
          title="Cerrar"
        >
          <FaTimes size={16} />
        </button>

        {/* 🔥 ENCABEZADO ELITE 🔥 */}
        <div className="text-center mb-6 pt-2">
          <span className="inline-block bg-black text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 shadow-sm">
            Administración
          </span>
          <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">
            Nuevo Usuario
          </h2>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          {/* Usuario */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
              Nombre de Usuario
            </label>
            <input
              type="text"
              placeholder="Ej. ChemaSportER"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
              />
              {/* ⭐ BOTÓN DEL OJO ⭐ */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1  -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Permisos (Switches) */}
        <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-100 mb-8">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
            Asignar Permisos
          </label>
          <div className="flex flex-col gap-3.5">
            {["add", "edit", "delete", "history"].map((perm) => (
              <label key={perm} className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-bold text-gray-700 select-none">
                  {roleLabels[perm]}
                </span>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={roles[perm]}
                    onChange={() =>
                      setRoles((prev) => ({ ...prev, [perm]: !prev[perm] }))
                    }
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${roles[perm] ? 'bg-black' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${roles[perm] ? 'transform translate-x-5' : ''}`}></div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Botones */}
        <div className="mt-auto">
          <button
            onClick={handleSubmit}
            className="w-full bg-black hover:bg-gray-900 text-white py-4 text-sm rounded-2xl font-black tracking-widest uppercase shadow-lg transition-transform transform hover:-translate-y-0.5"
          >
            Registrar Usuario
          </button>
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