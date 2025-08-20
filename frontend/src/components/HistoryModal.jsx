// src/components/HistoryModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaCalendarAlt } from "react-icons/fa";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

export default function HistoryModal({ open, onClose, isSuperUser = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [clearing, setClearing] = useState(false);

  // búsqueda por texto (opcional, la mantengo)
  const [q, setQ] = useState("");

  // ---- fecha seleccionada ----
  // vacío = sin filtro. Si quieres “hoy” por defecto, usa: new Date().toISOString().slice(0,10)
  const [selectedDate, setSelectedDate] = useState("");
  const dateInputRef = useRef(null);

  // helper: user guardado para headers
  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Cargar historial cuando abre o cambia fecha
  useEffect(() => {
    if (!open) return;
    let abort = false;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const roles = Array.isArray(storedUser?.roles)
          ? storedUser.roles.join(",")
          : "";
        const params = new URLSearchParams(
          selectedDate ? { date: selectedDate } : {}
        );
        const res = await fetch(`${API_BASE}/api/history? ` + params.toString(), {
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
  }, [open, storedUser, selectedDate]);

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
      const roles = Array.isArray(storedUser?.roles)
        ? storedUser.roles.join(",")
        : "";
      const xsuper = storedUser?.isSuperUser ? "true" : "false";

      const res = await fetch(`${API_BASE}/api/history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-super": xsuper,
          "x-roles": roles,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // refrescar con los mismos filtros
      const refreshed = await fetch(
        `${API_BASE}/api/history?` +
          new URLSearchParams(selectedDate ? { date: selectedDate } : {}),
        {
          headers: {
            "Content-Type": "application/json",
            "x-super": xsuper,
            "x-roles": roles,
          },
        }
      ).then((r) => r.json());

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
    <div className="fixed mt-24 mb-12 inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative bg-white p-6 rounded-lg shadow-md max-w-4xl w-full max-h-screen overflow-y-auto scroll-smooth">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-4 border-b">
          <h2 className="text-lg font-semibold">Historial</h2>

          <div className="flex items-center gap-2">
            {/* Botón Calendario */}
            <button
              onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border hover:bg-gray-100"
              title="Elegir fecha"
            >
              <FaCalendarAlt />
              <span className="text-sm">
                {selectedDate ? selectedDate : "Fecha"}
              </span>
            </button>

            {/* Limpiar fecha */}
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="text-xs px-2 py-1 rounded border hover:bg-gray-100"
                title="Quitar filtro de fecha"
              >
                Quitar fecha
              </button>
            )}

            {/* (Opcional) Borrar historial completo */}
            {isSuperUser && (
              <button
                onClick={handleAskClearToast}
                disabled={clearing}
                className="px-3 py-2 rounded border hover:bg-gray-100 disabled:opacity-50"
                title="Limpiar historial"
              >
                Limpiar
              </button>
            )}

            {/* Cerrar */}
            <button
              onClick={onClose}
              className="ml-2 p-2 rounded bg-black text-white hover:bg-gray-800"
              title="Cerrar"
            >
              <FaTimes size={18} />
            </button>
          </div>

          {/* input date oculto que abre el calendario nativo */}
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            aria-hidden
          />
        </div>

        {/* Buscador opcional por producto */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por producto…"
            className="border px-3 py-2 rounded w-full"
          />
        </div>

        {/* Body con scroll */}
        <div className="py-4">
          {loading && <p className="text-gray-500">Cargando…</p>}
          {!loading && errMsg && <p className="text-red-600">{errMsg}</p>}

          {!loading && !errMsg && filteredLogs.length === 0 && (
            <p className="text-gray-600">
              {selectedDate
                ? `No hay cambios registrados para ${selectedDate}.`
                : "No hay cambios registrados."}
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
                    {new Date(log.date).toLocaleString()}
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