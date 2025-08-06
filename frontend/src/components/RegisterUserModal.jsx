import { useState } from "react";
import { toast } from 'react-toastify';

export default function RegisterUserModal({ onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roles, setRoles] = useState({
    add: false,
    edit: false,
    delete: false,
  });

  const handleSubmit = async () => {
    try {
      const selectedRoles = Object.entries(roles)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      const payload = { username, password, roles: selectedRoles };

      const res = await fetch("https://chemas-sport-er-backend.onrender.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Usuario registrado correctamente");
        onClose();
      } else {
        toast.error(data.message || "Error al registrar usuario");
      }
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      toast.error("Error en el servidor");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded w-[90%] max-w-[600px]">
        <h2 className="text-xl font-bold mb-4">Registrar nuevo usuario</h2>

        {/* Usuario */}
        <div className="border p-2 w-full mb-3">
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Contraseña */}
        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 text-xs transform -translate-y-1/2 text-gray-600"
          >
            {showPassword ? "No Mostrar" : "Mostrar"}
          </button>
        </div>

        {/* Permisos */}
        <label className="block font-semibold mb-1">Permisos:</label>
        <div className="mb-4 space-y-2">
          {["add", "edit",].map((perm) => (
            <label key={perm} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={roles[perm]}
                onChange={() =>
                  setRoles((prev) => ({ ...prev, [perm]: !prev[perm] }))
                }
              />
              {perm === "add" && "Agregar productos"}
              {perm === "edit" && "Editar y eliminar productos"}

            </label>
          ))}
        </div>

        {/* Botones */}
        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-400 text-white rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}