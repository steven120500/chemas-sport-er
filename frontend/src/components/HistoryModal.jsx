// src/components/HistoryModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes } from 'react-icons/fa';

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function HistoryModal({ open, onClose, isSuperUser = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [clearing, setClearing] = useState(false);
  const [q, setQ] = useState(""); // <- término de búsqueda

  // helpers: tomar user guardado para mandar headers
  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Cargar historial cuando abre
  useEffect(() => {
    if (!open) return;
    let abort = false;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const roles =
          Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
        const res = await fetch(`${API_BASE}/api/history`, {
          headers: {
            "Content-Type": "application/json",
            "x-super": storedUser?.isSuperUser ? "true" : "false",
            "x-roles": roles,
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
  }, [open, storedUser]);

  // Confirm visual para borrar
  function handleAskClearToast() {
    if (!isSuperUser || clearing) return;
    toastHOT((t) => (
      <span>
        <p>¿Seguro que quieres <b>eliminar</b> todo el historial?</p>
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
    ), { duration: 6000 });
  }

  // Borrar historial (solo super)
  async function doClear() {
    if (!isSuperUser) return;
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/api/history, { method: "DELETE" }`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // refrescar lista
      const roles =
        Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const refreshed = await fetch(`${API_BASE}/api/history`, {
        headers: {
          "Content-Type": "application/json",
          "x-super": storedUser?.isSuperUser ? "true" : "false",
          "x-roles": roles,
        },
      }).then((r) => r.json());
      setLogs(Array.isArray(refreshed) ? refreshed : []);
      toastHOT.success("Historial limpiado.");
    } catch (e) {
      setErrMsg("No se pudo limpiar el historial.");
      toastHOT.error("No se pudo limpiar el historial.");
    } finally {
      setClearing(false);
    }
  }

  // Filtro por nombre de producto (log.item)
  const filteredLogs = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) =>
      String(log.item || "").toLowerCase().includes(term)
    );
  }, [logs, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-4 border-b">
          <h2 className="text-lg font-semibold"></h2>

          {/* Buscador */}
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por producto…"
            className=" flex sticky left top-0 z-10 bg-white border-b "
          />

          <div className="flex pr-20 items-center gap-2">
            {isSuperUser && (
              <button
                onClick={handleAskClearToast}
                disabled={clearing}
                title="Borrar todo el historial"
                className="whitespace-nowrap bg-gray-800 text-white text-sm px-3 py-2 rounded hover:bg-black"
              >
                {clearing ? "Limpiando..." : "Limpiar"}
              </button>
            )}
            <button
  onClick={onClose}
  className="absolute top-5 right-3 bg-black text-white w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded hover:bg-gray-800 text-2xl sm:text-xl"
>
  &times;
</button>
          
          </div>
        </div>

        {/* Body con scroll */}
        <div className="py-4">
          {loading && <p className="text-gray-500">Cargando...</p>}
          {!loading && errMsg && (
            <p className="text-red-600">{errMsg}</p>
          )}
          {!loading && !errMsg && filteredLogs.length === 0 && (
            <p className="text-gray-600">
              {q ? <>No hay resultados para “{q}”.</> : "No hay cambios registrados."}
            </p>
          )}

          {!loading && !errMsg && filteredLogs.length > 0 && (
            <ul className="space-y-3">
              {filteredLogs.map((log, idx) => (
                <li key={log._id || idx} className="border rounded p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{log.user || "Desconocido"}</strong>
                    <span className="text-gray-700">{log.action || "acción"}</span>
                  </div>

                  <em className="text-gray-700 block">{log.item || "—"}</em>
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