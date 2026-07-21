
import React, { useEffect, useMemo, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaFilter, FaMinusCircle, FaHistory, FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

/* --- utilidades de fecha local --- */
function pad2(n){ return n < 10 ? `0${n}` : `${n}`; }
function ymdLocal(d = new Date()){
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${y}-${m}-${dd}`;
}
function ymLocal(d = new Date()){
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  return `${y}-${m}`;
}

const BASE_USERS = ["Alisson", "Angie", "ChemaSportER", "Ema", "Johan", "Johanna", "Jose", "JuanPa", "Stef", "Stefanie"];

// ⭐ NUEVA FUNCIÓN CON DETECTOR DE CANTIDADES ⭐
function parseLogDetails(log) {
  const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");

  let cliente = "No especificado";
  const matchCliente = detailsStr.match(/Cliente:\s*([^|]+)/i);
  if (matchCliente && matchCliente[1]) cliente = matchCliente[1].trim();

  const vendedor = log.user || "Sistema";
  const nombreChema = log.item || "No especificado";

  const regex = /(Tienda #[12])\[(.*?)\]:\s*(\d+)\s*(?:->|→)\s*(\d+)/g;
  let match;
  const items = [];
  let hasMatches = false;

  while ((match = regex.exec(detailsStr)) !== null) {
    const tienda = match[1];
    const talla = match[2];
    const oldV = parseInt(match[3], 10);
    const newV = parseInt(match[4], 10);

    if (oldV > newV) {
      hasMatches = true;
      const cantidad = oldV - newV; // Matemáticas para saber cuántas se restaron

      // ⭐ Si rebajaron 2 o más de la misma, repetimos la línea esa cantidad de veces
      for (let i = 0; i < cantidad; i++) {
        items.push(`-  CAMISETA: ${nombreChema} talla ${talla}\n TIENDA: ${tienda}`);
      }
    }
  }

  if (!hasMatches) {
    const tiendaF = detailsStr.includes("Tienda #1") ? "Tienda #1" : (detailsStr.includes("Tienda #2") ? "Tienda #2" : "General");
    items.push(`-  CAMISETA: ${nombreChema}\n TIENDA: ${tiendaF}`);
  }

  return { cliente, vendedor, items };
}

// FORMATO INDIVIDUAL
function extractGuideData(log) {
  const data = parseLogDetails(log);
  return ` CLIENTE: ${data.cliente}\n${data.items.join('\n')}\nVendedor: ${data.vendedor}`;
}

export default function HistoryPage({ isSuperUser = false }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [activeTab, setActiveTab] = useState("history");

  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => ymLocal()); 
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ⭐ ESTADO PARA GUARDAR LAS CAJITAS MARCADAS ⭐
  const [selectedLogs, setSelectedLogs] = useState([]);

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Limpiar selecciones cuando cambian los filtros o la pestaña
  useEffect(() => {
    setSelectedLogs([]);
  }, [page, activeTab, q, startDate, endDate, selectedMonth, selectedUser, selectedStore]);

  const fetchLogs = async (overrideStart, overrideEnd, overrideMonth, overridePage) => {
    setLoading(true);
    setErrMsg("");
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const currentPage = overridePage !== undefined ? overridePage : page;

      const params = new URLSearchParams({
        page: String(activeTab === "history" ? currentPage : 1),
        limit: activeTab === "history" ? "30" : "3000",
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
      if (data.pages) setTotalPages(data.pages);

    } catch (e) {
      setErrMsg("No se pudo cargar la información.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(undefined, undefined, undefined, 1);
    // eslint-disable-next-line
  }, [activeTab, storedUser]); 

  const handleNextPage = () => {
    const next = Math.min(page + 1, totalPages);
    setPage(next);
    fetchLogs(undefined, undefined, undefined, next);
  };

  const handlePrevPage = () => {
    const prev = Math.max(page - 1, 1);
    setPage(prev);
    fetchLogs(undefined, undefined, undefined, prev);
  };

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
      setTotalPages(1);
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
          <button onClick={() => { toastHOT.dismiss(t.id); doClear(); }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 uppercase tracking-wider">Eliminar Todo</button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 uppercase tracking-wider">Cancelar</button>
        </div>
      </div>
    ), { duration: 6000 });
  }

  const handleClearFilters = () => {
    setStartDate(""); setEndDate(""); setSelectedUser(""); setSelectedStore(""); setQ(""); setPage(1);
    fetchLogs("", "", undefined, 1); 
    toastHOT.success("Filtros limpiados", { duration: 1500 });
  };

  // ⭐ FUNCIÓN PARA MARCAR/DESMARCAR CAJITAS ⭐
  const toggleSelection = (id) => {
    setSelectedLogs(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ⭐ FUNCIÓN PARA COPIAR VARIAS CAMISAS JUNTAS ⭐
  const handleCopyMultiple = () => {
    const logsToCopy = logs.filter(l => selectedLogs.includes(l._id));
    if (!logsToCopy.length) return;

    let cliente = "No especificado";
    let vendedor = "Sistema";
    const allItems = [];

    logsToCopy.forEach((log, index) => {
      const data = parseLogDetails(log);
      if (index === 0 || cliente === "No especificado") cliente = data.cliente;
      if (index === 0 || vendedor === "Sistema") vendedor = data.vendedor;
      allItems.push(...data.items);
    });

    const finalString = ` CLIENTE: ${cliente}\n${allItems.join('\n')}\nVendedor: ${vendedor}`;
    navigator.clipboard.writeText(finalString);
    
    toastHOT.success("¡Guía múltiple copiada! Lista para pegar ", { 
        style: { borderRadius: '12px', background: '#000', color: '#fff', fontSize: '12px', fontWeight: 'bold' }
    });
    
    setSelectedLogs([]); // Limpiamos la selección después de copiar
  };

  const uniqueUsers = useMemo(() => {
    const usersFromLogs = logs.map(l => l.user).filter(Boolean);
    return [...new Set([...BASE_USERS, ...usersFromLogs])].sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    const term = q.trim().toLowerCase();
    if (term) result = result.filter((log) => String(log.item || "").toLowerCase().includes(term));
    if (selectedUser) result = result.filter((log) => log.user === selectedUser);
    if (selectedStore) result = result.filter((log) => String(log.details || "").includes(selectedStore));
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
        let match; let restasEnEsteLog = 0;
        while ((match = regex.exec(detailsStr)) !== null) {
          const valorViejo = parseInt(match[1], 10) || 0;
          const valorNuevo = parseInt(match[2], 10) || 0;
          if (valorViejo > valorNuevo) restasEnEsteLog += (valorViejo - valorNuevo);
        }
        if (restasEnEsteLog > 0) {
          const username = log.user || "Desconocido";
          counts[username] = (counts[username] || 0) + restasEnEsteLog;
        }
      }
    });
    return Object.entries(counts).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count);
  }, [logs]); 

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-32 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-4xl mx-auto">
        
        {/* BOTÓN VOLVER */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 bg-transparent hover:text-black transition-colors mb-8 font-bold uppercase tracking-widest text-xs"
        >
          <FaChevronLeft size={14} /> Volver al catálogo
        </button>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
          <div className="text-center mb-8 mt-2">
            <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 shadow-sm">Administración</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">Registros del Sistema</h2>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
            <button onClick={() => setActiveTab("history")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === "history" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}><FaHistory /> Historial Detallado</button>
            <button onClick={() => setActiveTab("count")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === "count" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}><FaMinusCircle /> Conteo Mensual</button>
          </div>
          
          {activeTab === "history" && (
            <div className="animate-fade-in-up">
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 mb-8 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto..." className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all" />
                  <button onClick={() => setShowFilters(!showFilters)} className={`px-5 py-3 rounded-xl border flex items-center justify-center transition-all ${showFilters ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}><FaFilter size={14} /></button>
                </div>

                {showFilters && (
                  <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-gray-200 animate-fade-in-up">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="w-full"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Desde Fecha</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer" /></div>
                        <div className="w-full"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Hasta Fecha</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer" /></div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="w-full"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Usuario</label><select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"><option value="">Todos</option>{uniqueUsers.map((u) => (<option key={u} value={u}>{u}</option>))}</select></div>
                      <div className="w-full"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tienda</label><select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"><option value="">Todas</option><option value="Tienda #1">Tienda #1</option><option value="Tienda #2">Tienda #2</option></select></div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-2">
                      <button onClick={() => { setPage(1); fetchLogs(startDate, endDate, undefined, 1); }} className="w-full bg-black text-white border border-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-colors shadow-md">Buscar Fechas</button>
                      <button onClick={handleClearFilters} className="w-full bg-gray-100 text-gray-600 border border-gray-200 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">Limpiar</button>
                      {isSuperUser && (<button onClick={askClear} disabled={loading} className="w-full bg-red-50 text-red-600 border border-red-100 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50">Borrar Historial</button>)}
                    </div>
                  </div>
                )}
              </div>

              <div>
                {loading && <p className="text-gray-400 font-bold text-center py-6 uppercase tracking-widest text-xs">Cargando registros...</p>}
                {!loading && errMsg && <p className="text-red-500 font-bold text-center py-6 text-sm">{errMsg}</p>}

                {!loading && !errMsg && filteredLogs.length === 0 && (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100"><p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay cambios registrados.</p></div>
                )}

                {!loading && !errMsg && filteredLogs.length > 0 && (
                  <ul className="space-y-4">
                    {filteredLogs.map((log, idx) => {
                       const logDateObj = log.date ? new Date(log.date) : null;
                       const dateStr = logDateObj ? `${pad2(logDateObj.getDate())}/${pad2(logDateObj.getMonth()+1)}/${logDateObj.getFullYear()}` : "";
                       const timeStr = logDateObj ? logDateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
                       
                       const isSelected = selectedLogs.includes(log._id);

                       return (
                        <li key={log._id || idx} className={`relative bg-white border-2 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${isSelected ? 'border-black bg-gray-50' : 'border-gray-100'}`}>
                          
                          {/* ⭐ CHECKBOX Y DETALLES ⭐ */}
                          <div className="flex items-start gap-4 flex-1">
                            <div className="mt-1">
                                <input 
                                    type="checkbox" 
                                    checked={isSelected} 
                                    onChange={() => toggleSelection(log._id)} 
                                    className="w-5 h-5 accent-black cursor-pointer"
                                />
                            </div>
                            <div className="w-full">
                                <div className="mb-2"><strong className="text-gray-900 font-black text-sm">{log.user || "Desconocido"}</strong></div>
                                <em className="text-gray-800 font-bold block text-sm not-italic leading-tight">{log.item || "—"}</em>
                                <small className="flex items-center gap-1.5 text-gray-400 block mt-2 font-semibold text-xs"><FaCalendarAlt size={10} className="mb-0.5" />{dateStr} — {timeStr}</small>
                                {log.details && (
                                <pre className="mt-4 bg-white border border-gray-200 p-4 rounded-xl text-[11px] overflow-x-auto text-gray-600 font-mono whitespace-pre-wrap shadow-inner">
                                    {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
                                </pre>
                                )}
                            </div>
                          </div>

                          {/* BOTÓN INDIVIDUAL (Se oculta si estás marcando varios) */}
                          {selectedLogs.length === 0 && (
                            <div className="sm:w-48 shrink-0 mt-2 sm:mt-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                    const textoGuia = extractGuideData(log);
                                    navigator.clipboard.writeText(textoGuia);
                                    toastHOT.success("¡Guía copiada! Lista para pegar 📋", { style: { borderRadius: '12px', background: '#000', color: '#fff', fontSize: '12px', fontWeight: 'bold' }});
                                    }}
                                    className="w-full py-3 bg-black hover:bg-white hover:text-black rounded-xl text-[11px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border border-gray-200"
                                >
                                    <span>Copiar Guía</span>
                                </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* BOTONES DE PAGINACIÓN */}
                {!loading && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-gray-100">
                    <button onClick={handlePrevPage} disabled={page === 1} className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-xs font-bold disabled:opacity-30 flex items-center gap-2"><FaChevronLeft /> Anterior</button>
                    <span className="text-xs font-bold text-gray-500">Pág {page} de {totalPages}</span>
                    <button onClick={handleNextPage} disabled={page === totalPages} className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-xs font-bold disabled:opacity-30 flex items-center gap-2">Siguiente <FaChevronRight /></button>
                  </div>
                )}

              </div>
            </div>
          )}

          {activeTab === "count" && (
            <div className="animate-fade-in-up">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="text-xs font-black text-gray-400 uppercase tracking-widest text-center sm:text-left w-full sm:w-auto">Seleccionar Mes:</div>
                 <div className="flex gap-3 w-full sm:w-auto">
                     <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="flex-1 sm:flex-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-black text-gray-800 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer" />
                     <button onClick={() => fetchLogs()} className="bg-black text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-colors shadow-md whitespace-nowrap">Buscar</button>
                 </div>
              </div>
              {loading ? ( <p className="text-gray-400 font-bold text-center py-8 uppercase tracking-widest text-xs">Calculando restas mensuales...</p> ) : (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 bg-gray-50 border-b border-gray-100 text-center"><p className="text-xs font-black text-gray-400 uppercase tracking-widest">Camisetas reducidas del stock total</p></div>
                    {restasMensuales.length === 0 ? ( <div className="text-center py-10 bg-gray-50"><p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay datos en este periodo</p></div> ) : (
                        <div className="divide-y divide-gray-100">
                            {restasMensuales.map((userStat, idx) => (
                                <div key={userStat.user} className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${ userStat.count > 0 ? 'bg-black text-white' : 'bg-gray-200 text-gray-500' }`}>{idx + 1}</div><span className="font-black text-gray-800 text-base">{userStat.user}</span></div>
                                    <div className="flex items-center gap-2"><span className={`text-2xl font-black ${userStat.count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{userStat.count}</span><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">uds.</span></div>
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

      {/* ⭐ BOTÓN FLOTANTE GIGANTE PARA COPIAR VARIAS JUNTAS ⭐ */}
      {selectedLogs.length > 1 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
           <button 
                onClick={handleCopyMultiple} 
                className="bg-black text-white px-8 py-5 rounded-full shadow-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 hover:scale-105 transition-transform"
           >
              JUNTAR Y COPIAR ({selectedLogs.length})
           </button>
        </div>
      )}

    </div>
  );
}