import React, { useEffect, useState } from "react";

export default function UserListModal({ open, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch("https://chemas-sport-er-backend.onrender.com/api/auth/users");
        const data = await response.json();
        console.log("Usuarios recibidos:", data);
        setUsers(data);
      } catch (error) {
        console.error("Error al cargar usuarios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-md max-w-lg w-full">
        <h2 className="text-lg font-semibold mb-4">Usuarios registrados</h2>

        {loading ? (
          <p>Cargando usuarios...</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {users.length === 0 ? (
              <li>No hay usuarios registrados.</li>
            ) : (
              users.map((user) => (
                <li key={user._id} className="border-b pb-2">
                  <div><strong>Usuario:</strong> {user.username}</div>
                  <div><strong>Rol:</strong> {user.isSuperUser ? "Superadmin" : (user.roles.join(", ") || "Cliente")}</div>
                </li>
              ))
            )}
          </ul>
        )}

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}