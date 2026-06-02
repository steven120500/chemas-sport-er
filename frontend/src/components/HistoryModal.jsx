import React, { useEffect, useMemo, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaFilter, FaMinusCircle, FaHistory } from "react-icons/fa";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

/* --- utilidades de fecha local --- */
function pad2(n){ return n < 10 ? `0${n}` : `${n}`; }
function ymdLocal(d = new Date()){
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${y}-${m}-${dd}`;  // YYYY-MM-DD
}
function ymLocal(d = new Date()){
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  return `${y}-${m}`;        // YYYY-MM para el filtro mensual
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

  // ⭐ Pestaña activa ('history' = Historial Diario, 'count' = Conteo Mensual)
  const [activeTab, setActiveTab] = useState("history");

  const [q, setQ] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => ymdLocal());
  const [selectedMonth, setSelectedMonth] = useState(() => ymLocal()); 
  
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  
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
      setSelectedMonth(ymLocal());
      setSelectedUser("");
      setSelectedStore("");
      setQ("");
      setShowFilters(false);
      setActiveTab("history"); 
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

  // 🔥 Petición al Backend inteligente según la pestaña activa 🔥
  useEffect(() => {
    if (!open) return;
    let aborted = false;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
        
        // Si es historial, mandamos el día exacto. Si es conteo mensual, mandamos vacío para traer un lote grande.
        const targetDateQuery = activeTab === "history" ? selectedDate : "";

        const params = new URLSearchParams({
          page: "1",
          // Traemos 500 registros para un día, o 3000 para abarcar todo el mes en el conteo
          limit: activeTab === "history" ? "500" : "3000", 
          ...(targetDateQuery ? { date: targetDateQuery } : {}),          
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
          setErrMsg("No se pudo cargar la información.");
          setLogs([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [open, selectedDate, activeTab, storedUser]); // Se quitó selectedMonth de las dependencias para evitar recargas innecesarias al backend

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

  // Filtrado de la lista de Historial Diario (Pestaña 1)
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


  // ⭐ Lógica Matemática Local para Contar Camisetas Restadas (Pestaña 2) ⭐
  const restasMensuales = useMemo(() => {
    const counts = {};
    
    // Inicializar la lista fija de tus trabajadores en 0
    BASE_USERS.forEach(user => {
      counts[user] = 0;
    });

    logs.forEach(log => {
      if (!log.date) return;
      
      // Extraemos el mes exacto del registro actual ("YYYY-MM")
      const d = new Date(log.date);
      const logMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      
      // 🔥 FILTRO ESTRICTO: Si el registro no es del mes que elegiste, se ignora
      if (logMonth !== selectedMonth) return;

      const isUpdate = log.action && String(log.action).toLowerCase().includes("actualiz");
      
      // Analizamos los logs de cambios de stock e inventario
      if (isUpdate && log.details) {
        const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details);
        
        // Soporta la flecha unicode "→" y la normal "->"
        const regex = /(\d+)\s*(?:->|→)\s*(\d+)/g;
        let match;
        let restasEnEsteLog = 0;
        
        while ((match = regex.exec(detailsStr)) !== null) {
          const valorViejo = parseInt(match[1], 10) || 0;
          const valorNuevo = parseInt(match[2], 10) || 0;
          
          // Si el valor nuevo es MENOR, significa que se restaron camisetas del stock
          if (valorViejo > valorNuevo) {
            restasEnEsteLog += (valorViejo - valorNuevo);
          }
        }
        
        if (restasEnEsteLog > 0) {
          const username = log.user || "Desconocido";
          if (counts[username] !== undefined) {
            counts[username] += restasEnEsteLog;
          } else {
            counts[username] = restasEnEsteLog;
          }
        }
      }
    });

    // Ordenar de mayor cantidad de restas a menor
    return Object.entries(counts)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count);
      
  }, [logs, selectedMonth]); // Re-calcula instantáneamente cuando cambias de mes


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      
      {/* FONDO DIFUMINADO */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

<div 
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col z-10 animate-fade-in-up"
        style={{ maxHeight: '85vh' }} // Forzamos una altura máxima estricta para garantizar el scroll
      >
        {/* BOTÓN DE CERRAR */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2.5 z-20 transition-colors"
          title="Cerrar"
        >
          <FaTimes className="text-sm sm:text-base" />
        </button>

        {/* ENCABEZADO FIJO */}
        <div className="flex-none p-6 sm:p-8 pb-2">
          <div className="text-center mb-5 mt-2">
            <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 shadow-sm">
              Administración
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">
              Registros del Sistema
            </h2>
          </div>

          {/* SPREAD TABS (Selector de Vista) */}
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-4">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "history" 
                  ? "bg-white text-black shadow-sm" 
                  : "text-gray-500 hover:text-black"
              }`}
            >
              <FaHistory /> Historial Diario
            </button>
            <button
              onClick={() => setActiveTab("count")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "count" 
                  ? "bg-white text-black shadow-sm" 
                  : "text-gray-500 hover:text-black"
              }`}
            >
              <FaMinusCircle /> Conteo Mensual
            </button>
          </div>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 px-6 sm:px-8 pb-6 sm:pb-8 min-h-0">
          
          {/* =========================================
              VISTA 1: HISTORIAL DIARIO (DÍA A DÍA)
          ========================================= */}
          {activeTab === "history" && (
            <div className="animate-fade-in-up">
              {/* FILTROS DIARIOS */}
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 mb-6 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
                  />
                  <button
                    onClick={() => { setShowFilters(!showFilters); }}
                    className={`px-4 py-2.5 rounded-xl border flex items-center justify-center transition-all ${
                      showFilters 
                        ? 'bg-black text-white border-black shadow-md' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
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

              {/* LISTA DE ACCIONES */}
              <div>
                {loading && <p className="text-gray-400 font-bold text-center py-6 uppercase tracking-widest text-[10px] sm:text-xs">Cargando registros...</p>}
                {!loading && errMsg && <p className="text-red-500 font-bold text-center py-6 text-sm">{errMsg}</p>}

                {!loading && !errMsg && filteredLogs.length === 0 && (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay cambios registrados este día</p>
                  </div>
                )}

                {!loading && !errMsg && filteredLogs.length > 0 && (
                  <ul className="space-y-4">
                    {filteredLogs.map((log, idx) => (
                      <li key={log._id || idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <strong className="text-gray-900 font-black text-sm">{log.user || "Desconocido"}</strong>
                        
                        </div>
                        <em className="text-gray-800 font-bold block text-sm not-italic leading-tight">{log.item || "—"}</em>
                        <small className="text-gray-400 block mt-1 font-semibold text-xs">
                          {log.date ? new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                        </small>
                        {log.details && (
                          <pre className="mt-3 bg-gray-50 border border-gray-100 p-3 rounded-xl text-[11px] overflow-x-auto text-gray-600 font-mono whitespace-pre-wrap shadow-inner">
                            {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* =========================================
              VISTA 2: CONTEO MENSUAL DE CAMISETAS RESTADAS
          ========================================= */}
          {activeTab === "count" && (
            <div className="animate-fade-in-up">
              
              {/* SELECTOR EXCLUSIVO DE MES (Año - Mes) */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 flex items-center justify-between gap-4">
                 <div className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">
                      Seleccionar Mes:
                 </div>
                 <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value || ymLocal())}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-black text-gray-800 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                  />
              </div>

              {loading ? (
                 <p className="text-gray-400 font-bold text-center py-8 uppercase tracking-widest text-[10px] sm:text-xs">Calculando restas mensuales...</p>
              ) : (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Camisetas reducidas del stock total
                        </p>
                    </div>
                    {restasMensuales.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50">
                            <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay datos en este periodo</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {restasMensuales.map((userStat, idx) => (
                                <div key={userStat.user} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                            userStat.count > 0 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <span className="font-black text-gray-800 text-sm">{userStat.user}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xl font-black ${userStat.count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                            {userStat.count}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">uds.</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              )}
            </div>
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