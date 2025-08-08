import React, { useEffect, useState } from "react";

// Cambia esto si tienes un helper para el base URL
const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function HistoryModal({ open, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    let abort = false;

    async function load() {
      setLoading(true);
      setErrMsg("");
      try {
        const res = await fetch(`${API_BASE}/api/history`, {
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!abort) setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!abort) {
          console.error("Error cargando historial:", err);
          setErrMsg("No se pudo cargar el historial.");
          setLogs([]);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }

    load();
    return () => { abort = true; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-lg max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Historial de cambios</h2>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading && <p className="text-gray-500">Cargando…</p>}
          {!loading && errMsg && (
            <p className="text-red-600">{errMsg}</p>
          )}
          {!loading && !errMsg && logs.length === 0 && (
            <p className="text-gray-600">No hay cambios registrados.</p>
          )}

          {!loading && !errMsg && logs.length > 0 && (
            <ul className="space-y-3">
              {logs.map((log, idx) => (
                <li
                  key={log._id || idx}
                  className="border rounded p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <strong>{log.user || "Desconocido"}</strong>{" "}
                      <span className="text-gray-700">
                        {log.action || "acción"}
                      </span>{" "}
                      <em className="text-gray-700">
                        {log.item || ""}
                      </em>
                    </div>
                    <small className="text-gray-500">
                      {log.date ? new Date(log.date).toLocaleString() : ""}
                    </small>
                  </div>

                  {/* Si guardaste más info, muéstrala aquí */}
                  {log.details && (
                    <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                      {typeof log.details === "string"
                        ? log.details
                        : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}