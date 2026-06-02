import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaFilter } from "react-icons/fa";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

/* --- util fecha local --- */
function pad2(n){ return n < 10 ? `0${n}` : `${n}`; }
function ymdLocal(d = new Date()){
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${y}-${m}-${dd}`;  // YYYY-MM-DD en tu zona horaria
}

// ⭐ LISTA FIJA DE USUARIOS
const BASE_USERS = [
  "Alisson", 
  "Angie", 
  "ChemaSportER", 
  "Ema", 
  "Johan", 
  "Johanna", 
  "Jose", 
  "JuanPa", 
  "Stef", 
  "Stefanie"
];

export default function HistoryModal({ open, onClose, isSuperUser = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const [q, setQ] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => ymdLocal());
  
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  
  // ⭐ ESTADO PARA MOSTRAR/OCULTAR LOS FILTROS EXTRAS
  const [showFilters, setShowFilters] = useState(false);

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedDate(ymdLocal());
      setSelectedUser("");
      setSelectedStore("");
      setQ("");
      setShowFilters(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

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
          date: selectedDate,          
          _: String(Date.now()), 
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
      <div className="text-center p-1">
        <p className="font-black text-gray-800 mb-3 text-sm sm:text-base">¿Eliminar todo el historial?</p>
        <div className="mt-2 flex gap-2 justify-center">
          <button
            onClick={() => { toastHOT.dismiss(t.id); doClear(); }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 uppercase tracking-wider"
          >
            Eliminar
          </button>
          <button
            onClick={() => toastHOT.dismiss(t.id)}
            className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 uppercase tracking-wider"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  }

  const uniqueUsers = useMemo(() => {
    const usersFromLogs = logs.map(l => l.user).filter(Boolean);
    return [...new Set([...BASE_USERS, ...usersFromLogs])].sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    const term = q.trim().toLowerCase();
    if (term) {
      result = result.filter((log) => String(log.item || "").toLowerCase().includes(term));
    }

    if (selectedUser) {
      result = result.filter((log) => log.user === selectedUser);
    }

    if (selectedStore) {
      result = result.filter((log) => {
        const details = String(log.details || "");
        return details.includes(selectedStore);
      });
    }

    return result;
  }, [logs, q, selectedUser, selectedStore]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      
      {/* 🔥 FONDO DIFUMINADO PREMIUM 🔥 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* 🔥 CAJA DEL MODAL 🔥 */}
      <div 
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col z-10 animate-fade-in-up"
        style={{ maxHeight: '85vh' }} // Forzamos una altura máxima estricta para garantizar el scroll
      >
        
        {/* 🔥 BOTÓN DE CERRAR 🔥 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors"
          title="Cerrar"
        >
          <FaTimes size={18} />
        </button>

        {/* 🔥 ZONA FIJA SUPERIOR (flex-none impide que se encoja o haga scroll) 🔥 */}
        <div className="flex-none px-6 pt-6 pb-2 sm:px-8 sm:pt-8">
          
          <div className="text-center mb-5 mt-2">
            <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-3 shadow-sm">
              Registro del Sistema
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">
              Historial
            </h2>
          </div>

          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 flex flex-col gap-3 transition-all duration-300">
            
            <div className="flex gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 rounded-xl border flex items-center justify-center transition-all ${
                  showFilters 
                    ? 'bg-black text-white border-black shadow-md' 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
                title="Más Filtros"
              >
                <FaFilter size={14} />
              </button>
            </div>

            {showFilters && (
              <div className="flex flex-col gap-3 mt-1 pt-3 border-t border-gray-200 animate-fade-in-up">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || ymdLocal())}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                  title="Elegir fecha"
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                  >
                    <option value="">Todos los usuarios</option>
                    {uniqueUsers.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>

                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                  >
                    <option value="">Todas las tiendas</option>
                    <option value="Tienda #1">Tienda #1</option>
                    <option value="Tienda #2">Tienda #2</option>
                  </select>
                </div>

                {isSuperUser && (
                  <button
                    onClick={askClear}
                    disabled={loading}
                    className="w-full bg-red-50 text-red-600 border border-red-100 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 mt-1"
                  >
                    Limpiar Historial de Fecha
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 🔥 ZONA DE SCROLL (flex-1 overflow-y-auto la fuerza a calcular su tamaño) 🔥 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 px-6 sm:px-8 pb-6 sm:pb-8">
          {loading && <p className="text-gray-400 font-bold text-center py-10 uppercase tracking-widest text-xs">Cargando registros...</p>}
          {!loading && errMsg && <p className="text-red-500 font-bold text-center py-10 text-sm">{errMsg}</p>}

          {!loading && !errMsg && filteredLogs.length === 0 && (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100 mt-2">
              <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">
                {q || selectedUser || selectedStore ? "No hay resultados para estos filtros" : "No hay cambios registrados este día"}
              </p>
            </div>
          )}

          {!loading && !errMsg && filteredLogs.length > 0 && (
            <ul className="space-y-4 mt-2">
              {filteredLogs.map((log, idx) => (
                <li key={log._id || idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <strong className="text-gray-900 font-black text-sm">{log.user || "Desconocido"}</strong>
                    
                  
                    
                  </div>

                  <em className="text-gray-800 font-bold block text-sm not-italic">{log.item || "—"}</em>
                  <small className="text-gray-400 block mt-1 font-semibold text-xs">
                    {log.date ? new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                  </small>

                  {log.details && (
                    <pre className="mt-4 bg-gray-50 border border-gray-100 p-3.5 rounded-xl text-[11px] overflow-x-auto text-gray-600 font-mono whitespace-pre-wrap shadow-inner">
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

      <style>{`
        @keyframes fadeInUpModal {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}