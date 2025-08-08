import React, { useEffect, useState } from "react";

export default function HistoryModal({ onClose }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch("https://chemas-sport-er-backend.onrender.com/api/history")
      .then(res => res.json())
      .then(data => setLogs(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Historial de cambios</h2>
        {logs.length === 0 ? (
          <p>No hay cambios registrados.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log, index) => (
              <li key={index} className="border-b pb-2">
                <strong>{log.user}</strong> {log.action} <em>{log.item}</em><br />
                <small>{new Date(log.date).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}