import React, { useEffect, useMemo, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaFilter, FaMinusCircle, FaHistory, FaCalendarAlt } from "react-icons/fa";

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

// ⭐ FUNCIÓN INTELIGENTE PARA EXTRAER LOS DATOS EN FORMATO GUÍA
function extractGuideData(log) {
  const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");
  
  // 1. Extraer Cliente
  let cliente = "No especificado (Venta General)";
  const matchCliente = detailsStr.match(/Cliente:\s*([^|]+)/i);
  if (matchCliente && matchCliente[1]) {
    cliente = matchCliente[1].trim();
  }

  // 2. Extraer Tienda
  let tienda = "No especificada";
  if (detailsStr.includes("Tienda #1") && detailsStr.includes("Tienda #2")) {
    tienda = "Tienda #1 y Tienda #2";
  } else if (detailsStr.includes("Tienda #1")) {
    tienda = "Tienda #1";
  } else if (detailsStr.includes("Tienda #2")) {
    tienda = "Tienda #2";
  }

  // 3. Extraer Talla o cambio exacto (ej: [L]: 1 → 0)
  const cambios = detailsStr
    .split("|")
    .map(part => part.trim())
    .filter(part => !part.includes("Cliente:") && !part.includes("🏬 Tienda #") && part !== "Tienda #1" && part !== "Tienda #2")
    .join(" | ");

  const camiseta = `${log.item || "No especificado"}${cambios ? ` — (${cambios})` : ""}`;
  const vendedor = log.user || "Sistema";

  return `📦 GUÍA DE PEDIDO / ENTREGA\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `👤 CLIENTE: ${cliente}\n` +
         `👕 CAMISETA: ${camiseta}\n` +
         `🧑‍💻 VENDEDOR: ${vendedor}\n` +
         `🏬 TIENDA: ${tienda}\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━`;
}

export default function HistoryModal({ open, onClose, isSuperUser = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // ⭐ Pestaña activa
  const [activeTab, setActiveTab] = useState("history");

  const [q, setQ] = useState("");
  
  // ⭐ Estados de Fechas
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
      setStartDate("");
      setEndDate("");
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

  // 🔥 FUNCIÓN CENTRAL: Petición al Backend 🔥
  const fetchLogs = async (overrideStart, overrideEnd, overrideMonth) => {
    setLoading(true);
    setErrMsg("");
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      
      const params = new URLSearchParams({
        page: "1",
        limit: "3000",
        _: String(Date.now()), 
      });

      const finalStart = overrideStart !== undefined ? overrideStart : startDate;
      const finalEnd = overrideEnd !== undefined ? overrideEnd : endDate;
      const finalMonth = overrideMonth !== undefined ? overrideMonth : selectedMonth;

      if (activeTab === "history") {
        if (finalStart) params.append("startDate", finalStart);
        if (finalEnd) params.append("endDate", finalEnd);
      } else if (activeTab === "count") {
        if (finalMonth) params.append("month", finalMonth);
      }

      const res = await fetch(`${API_BASE}/api/history?` + params.toString(), {
        headers: {
          "Content-Type": "application/json",
          "x-super": storedUser?.isSuperUser ? "true" : "false",
          "x-roles": roles,
        },
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setLogs(items);
    } catch (e) {
      setErrMsg("No se pudo cargar la información.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
    // eslint-disable-next-line
  }, [open, activeTab, storedUser]); 


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
        <p className="font-black text-gray-800 mb-3 text-sm sm:text-base">¿Eliminar TODO el historial permanentemente?</p>
        <div className="mt-2 flex gap-2 justify-center">
          <button
            onClick={() => { toastHOT.dismiss(t.id); doClear(); }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 uppercase tracking-wider"
          >
            Eliminar Todo
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

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedUser("");
    setSelectedStore("");
    setQ("");
    fetchLogs("", "", undefined); 
    toastHOT.success("Filtros limpiados", { duration: 1500 });
  };

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


  const restasMensuales = useMemo(() => {
    const counts = {};
    BASE_USERS.forEach(user => counts[user] = 0);

    logs.forEach(log => {
      const isUpdate = log.action && String(log.action).toLowerCase().includes("actualiz");
      
      if (isUpdate && log.details) {
        const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details);
        const regex = /(\d+)\s*(?:->|→)\s*(\d+)/g;
        let match;
        let restasEnEsteLog = 0;
        
        while ((match = regex.exec(detailsStr)) !== null) {
          const valorViejo = parseInt(match[1], 10) || 0;
          const valorNuevo = parseInt(match[2], 10) || 0;
          
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

    return Object.entries(counts)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count);
      
  }, [logs]); 


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
        style={{ maxHeight: '85vh' }} 
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

          {/* SPREAD TABS */}
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-4">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "history" 
                  ? "bg-white text-black shadow-sm" 
                  : "text-gray-500 hover:text-black"
              }`}
            >
              <FaHistory /> Historial Detallado
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
          
          {/* VISTA 1: HISTORIAL */}
          {activeTab === "history" && (
            <div className="animate-fade-in-up">
              {/* FILTROS */}
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
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="w-full">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Desde Fecha</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                            />
                        </div>
                        <div className="w-full">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Hasta Fecha</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="w-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Usuario</label>
                        <select
                          value={selectedUser}
                          onChange={(e) => setSelectedUser(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                        >
                          <option value="">Todos</option>
                          {uniqueUsers.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tienda</label>
                        <select
                          value={selectedStore}
                          onChange={(e) => setSelectedStore(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                        >
                          <option value="">Todas</option>
                          <option value="Tienda #1">Tienda #1</option>
                          <option value="Tienda #2">Tienda #2</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-2">
                      <button
                        onClick={() => fetchLogs()}
                        className="w-full bg-black text-white border border-black py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-colors shadow-md"
                      >
                        Buscar Fechas
                      </button>

                      <button
                        onClick={handleClearFilters}
                        className="w-full bg-gray-100 text-gray-600 border border-gray-200 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                      >
                        Limpiar
                      </button>
                      
                      {isSuperUser && (
                        <button
                          onClick={askClear}
                          disabled={loading}
                          className="w-full bg-red-50 text-red-600 border border-red-100 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          Borrar Historial
                        </button>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* LISTA DE ACCIONES */}
              <div>
                {loading && <p className="text-gray-400 font-bold text-center py-6 uppercase tracking-widest text-[10px] sm:text-xs">Cargando registros...</p>}
                {!loading && errMsg && <p className="text-red-500 font-bold text-center py-6 text-sm">{errMsg}</p>}

                {!loading && !errMsg && filteredLogs.length === 0 && (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay cambios registrados con estos filtros.</p>
                  </div>
                )}

                {!loading && !errMsg && filteredLogs.length > 0 && (
                  <ul className="space-y-4">
                    {filteredLogs.map((log, idx) => {
                       const logDateObj = log.date ? new Date(log.date) : null;
                       const dateStr = logDateObj ? `${pad2(logDateObj.getDate())}/${pad2(logDateObj.getMonth()+1)}/${logDateObj.getFullYear()}` : "";
                       const timeStr = logDateObj ? logDateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";

                       return (
                        <li key={log._id || idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow flex flex-col justify-between">
                          
                          <div>
                            <div className="mb-2">
                              <strong className="text-gray-900 font-black text-sm">{log.user || "Desconocido"}</strong>
                            </div>
                            
                            <em className="text-gray-800 font-bold block text-sm not-italic leading-tight">{log.item || "—"}</em>
                            
                            <small className="flex items-center gap-1.5 text-gray-400 block mt-1.5 font-semibold text-xs">
                              <FaCalendarAlt size={10} className="mb-0.5" />
                              {dateStr} — {timeStr}
                            </small>

                            {log.details && (
                              <pre className="mt-3 bg-gray-50 border border-gray-100 p-3 rounded-xl text-[11px] overflow-x-auto text-gray-600 font-mono whitespace-pre-wrap shadow-inner">
                                {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>

                          {/* ⭐ BOTÓN PARA SACAR LA GUÍA EXACTA CON LOS 4 DATOS ⭐ */}
                          <button
                            type="button"
                            onClick={() => {
                              const textoGuia = extractGuideData(log);
                              navigator.clipboard.writeText(textoGuia);
                              
                              toastHOT.success("¡Guía de pedido copiada! Lista para pegar 📋", {
                                style: {
                                  borderRadius: '12px',
                                  background: '#000',
                                  color: '#fff',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }
                              });
                            }}
                            className="mt-4 w-full py-3 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
                          >
                            <span>📋 Copiar Guía de Envío / Pedido</span>
                          </button>

                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: CONTEO MENSUAL */}
          {activeTab === "count" && (
            <div className="animate-fade-in-up">
              
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1 text-center sm:text-left w-full sm:w-auto">
                      Seleccionar Mes:
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto">
                     <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex-1 sm:flex-none bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-black text-gray-800 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                      />
                      <button
                        onClick={() => fetchLogs()}
                        className="bg-black text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-colors shadow-md whitespace-nowrap"
                      >
                        Buscar
                      </button>
                 </div>
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