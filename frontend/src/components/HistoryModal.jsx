import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes } from "react-icons/fa";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

/* --- util fecha local --- */
function pad2(n){ return n < 10 ? `0${n}` : `${n}`; }
function ymdLocal(d = new Date()){
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${y}-${m}-${dd}`;  // YYYY-MM-DD en tu zona horaria
}

export default function HistoryModal({ open, onClose, isSuperUser = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const [q, setQ] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => ymdLocal());

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Asegura que al ABRIR el modal, la fecha sea hoy local
  useEffect(() => {
    if (open) setSelectedDate(ymdLocal());
  }, [open]);

  // Carga historial cuando cambia fecha o se abre
  useEffect(() => {
    if (!open) return;
    let aborted = false;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";

        const params = new URLSearchParams({
          page: "1",
          limit: "500",
          date: selectedDate,          // 👈 ya NO sumamos +1
          _: String(Date.now()),       // evita cache
        });

        const res = await fetch(`${API_BASE}/api/history?` + params.toString(), {
          headers: {
            "Content-Type": "application/json",
            "x-super": storedUser?.isSuperUser ? "true" : "false",
            "x-roles": roles,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];

        if (!aborted) setLogs(items);
      } catch (e) {
        if (!aborted) {
          setErrMsg("No se pudo cargar el historial.");
          setLogs([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [open, selectedDate, storedUser]);

  async function doClear() {
    if (!isSuperUser) return;
    setLoading(true);
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const xsuper = storedUser?.isSuperUser ? "true" : "false";
      const res = await fetch(`${API_BASE}/api/history`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-super": xsuper, "x-roles": roles },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toastHOT.success("Historial limpiado.");
      setLogs([]);
    } catch {
      toastHOT.error("No se pudo limpiar el historial.");
    } finally {
      setLoading(false);
    }
  }

  function askClear() {
    if (!isSuperUser || loading) return;
    toastHOT((t) => (
      <span>
        <p>¿Seguro que quieres <b>eliminar</b> todo el historial?</p>
        <div className="mt-2 flex gap-2 justify-end">
          <button
            onClick={() => { toastHOT.dismiss(t.id); doClear(); }}
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

  const filteredLogs = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => String(log.item || "").toLowerCase().includes(term));
  }, [logs, q]);

  if (!open) return null;

  return (
    <div className="mt-32 mb-24 fixed inset-0 z-50 bg-black/40 flex items-center justify-center py-6">
      <div className="relative bg-white pt-15 p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400">
        {/* Header con calendario dentro */}
        <div className="flex items-center gap-2 pb-4 border-b">
          <h2 className="text-lg font-semibold flex-1">Historial</h2>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || ymdLocal())}
            className="border rounded px-2 py-1 text-sm"
            title="Elegir fecha"
          />

          <button
            onClick={onClose}
            className="text-white hover:text-gray-800 bg-black rounded p-1"
            title="Cerrar"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* Controles secundarios */}
        <div className="flex flex-wrap items-center gap-2 py-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por producto..."
            className="border rounded px-3 py-2 flex-1 min-w-[220px]"
          />

          {isSuperUser && (
            <button
              onClick={askClear}
              disabled={loading}
              className="ml-auto bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Body */}
        <div className="py-2">
          {loading && <p className="text-gray-500">Cargando...</p>}
          {!loading && errMsg && <p className="text-red-600">{errMsg}</p>}

          {!loading && !errMsg && filteredLogs.length === 0 && (
            <p className="text-gray-600">
              {q ? <>No hay resultados para “{q}”.</> : <>No hay cambios registrados.</>}
            </p>
          )}

          {!loading && !errMsg && filteredLogs.length > 0 && (
            <ul className="space-y-3 mt-2">
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