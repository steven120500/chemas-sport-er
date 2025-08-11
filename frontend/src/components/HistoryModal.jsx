// src/components/HistoryModal.jsx
import React, { useEffect, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function HistoryModal({ open, onClose, isSuperUser = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [clearing, setClearing] = useState(false);

  // Cargar historial cuando el modal abre
  useEffect(() => {
    if (!open) return;
    let abort = false;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const res = await fetch(`${API_BASE}/api/history`, {
          headers: {  
            "Content-Type": "application/json",
            "x-super": storedUser?.isSuperUser ? "true" : "false",
            "x-roles": storedUser?.roles?.join(".") || ""
        },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!abort) setLogs(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!abort) {
          setErrMsg("No se pudo cargar el historial.");
          setLogs([]);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [open]);

  // --- Confirmación bonita para limpiar ---
  function handleAskClearToast() {
    if (!isSuperUser || clearing) return;

    toastHOT(
      (t) => (
        <span>
          <p>
            ¿Seguro que quieres <b>eliminar</b> todo el historial?
          </p>
          <div className="mt-2 flex gap-2 justify-end">
            <button
              onClick={() => {
                toastHOT.dismiss(t.id);
                doClear();
              }}
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
      ),
      { duration: 6000 }
    );
  }

  // --- Borrar historial y refrescar lista ---
  async function doClear() {
    if (!isSuperUser) return;
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/api/history, { method: "DELETE" }`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const refreshed = await fetch(`${API_BASE}/api/history`).then((r) =>
        r.json()
      );
      setLogs(Array.isArray(refreshed) ? refreshed : []);
      toastHOT.success("Historial limpiado.");
    } catch (e) {
      setErrMsg("No se pudo limpiar el historial.");
      toastHOT.error("No se pudo limpiar el historial.");
    } finally {
      setClearing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* Card: fijamos alto y escondemos overflow; el body tendrá el scroll */}
      <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <h2 className="text-lg font-semibold">Historial de cambios</h2>
          <div className="flex items-center gap-2">
            {isSuperUser && (
              <button
                onClick={handleAskClearToast}
                disabled={clearing}
                className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                title="Borrar todo el historial"
              >
                {clearing ? "Limpiando..." : "Limpiar historial"}
              </button>
            )}

            <button
              onClick={onClose}
              className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Body con scroll */}
        <div className="p-4">
          {loading && <p className="text-gray-500">Cargando...</p>}
          {!loading && errMsg && (
            <p className="text-red-600">{errMsg}</p>
          )}
          {!loading && !errMsg && logs.length === 0 && (
            <p className="text-gray-600">No hay cambios registrados.</p>
          )}

          {!loading && !errMsg && logs.length > 0 && (
            <ul className="space-y-3">
              {logs.map((log, idx) => (
                <li key={log._id || idx} className="border rounded p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{log.user || "Desconocido"}</strong>
                    <span className="text-gray-700">{log.action || "acción"}</span>
                  </div>

                  <em className="text-gray-700 block">
                    {log.item || "—"}
                  </em>

                  <small className="text-gray-500 block mt-1">
                    {log.date ? new Date(log.date).toLocaleString() : ""}
                  </small>

                  {log.details && (
                    <pre className="mt-2 bg-gray-50 p-2 rounded text-[11px] overflow-x-auto">
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