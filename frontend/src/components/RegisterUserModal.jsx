import { useState } from "react";
import { toast } from "react-toastify";

export default function RegisterUserModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roles, setRoles] = useState({
    add: false,
    edit: false,
    delete: false,
  });

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Todos los campos son requeridos");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Correo inválido");
      return;
    }

    try {
      const response = await fetch("https://chemas-sport-er-backend.onrender.com/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          roles: Object.entries(roles)
            .filter(([_, value]) => value)
            .map(([key]) => key),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Error al registrar usuario");
        return;
      }

      toast.success(data.message || "Usuario registrado con éxito");
      onClose();
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      toast.error("Ocurrió un error al registrar el usuario");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">Registrar nuevo usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded"
          />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded"
          />
          <label className="text-sm">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
            />{" "}
            Mostrar contraseña
          </label>

          <div>
            <p className="font-medium">Permisos:</p>
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={roles.add}
                onChange={() =>
                  setRoles((prev) => ({ ...prev, add: !prev.add }))
                }
              />{" "}
              Agregar productos
            </label>
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={roles.edit}
                onChange={() =>
                  setRoles((prev) => ({ ...prev, edit: !prev.edit }))
                }
              />{" "}
              Editar y eliminar productos
            </label>
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={roles.delete}
                onChange={() =>
                  setRoles((prev) => ({ ...prev, delete: !prev.delete }))
                }
              />{" "}
              Eliminar productos
            </label>
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
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}