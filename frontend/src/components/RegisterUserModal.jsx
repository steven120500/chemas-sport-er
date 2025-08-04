import { useState } from "react";

export default function RegisterUserModal({ onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState({
    add: false,
    edit: false,
    delete: false,
  });

  const handleSubmit = async () => {
    try {
      const res = await fetch("https://tu-backend.com/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          roles: Object.keys(roles).filter((key) => roles[key]),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Usuario registrado correctamente");
        onClose();
      } else {
        alert(data.message || "Error al registrar usuario");
      }
    } catch (err) {
      alert("Error en el servidor");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded w-[90%] max-w-md">
        <h2 className="text-xl font-bold mb-4">Registrar nuevo usuario</h2>

        <input
          className="border p-2 w-full mb-3"
          placeholder="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="border p-2 w-full mb-3"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="mb-4">
          <label className="block font-semibold mb-1">Permisos:</label>
          {["add", "edit", "delete"].map((perm) => (
            <label key={perm} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={roles[perm]}
                onChange={() => setRoles((prev) => ({ ...prev, [perm]: !prev[perm] }))}
              />
              {perm === "add" && "Agregar productos"}
              {perm === "edit" && "Editar productos"}
              {perm === "delete" && "Eliminar productos"}
            </label>
          ))}
        </div>

        <div className="flex justify-between">
          <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded">
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}