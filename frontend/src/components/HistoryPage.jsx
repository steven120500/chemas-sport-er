
import React, { useEffect, useMemo, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { FaFilter, FaCalendarAlt, FaChevronLeft, FaChevronRight, FaTrash, FaTimes, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

const BASE_USERS = ["Alisson", "Angie", "ChemaSportER", "Ema", "Johan", "Johanna", "Jose", "JuanPa", "Stef", "Stefanie"];

// 🛡️ PARSEO INDESTRUCTIBLE DE TALLAS PARA EL BOTÓN DE COPIAR
function parseLogDetails(log) {
  let detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");

  // Limpiamos el ID del texto antes de buscar las tallas para que no se confunda
  detailsStr = detailsStr.replace(/\[ID:[^\]]+\]\s*\|\s*/g, "");

  let cliente = "No especificado";
  const matchCliente = detailsStr.match(/Cliente:\s*([^|]+)/i);
  if (matchCliente && matchCliente[1]) cliente = matchCliente[1].trim();

  const vendedor = log.user || "Sistema";
  const nombreChema = log.item || "No especificado";

  const items = [];
  let hasMatches = false;

  // 🔥 SOLUCIÓN: Separamos por el carácter "|" para evaluar cada talla en su propio contexto
  const segmentos = detailsStr.split('|');

  segmentos.forEach(segmento => {
    const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/gi;
    let match;

    while ((match = regex.exec(segmento)) !== null) {
      const talla = String(match[1]).trim();
      const oldV = parseInt(match[2], 10) || 0;
      const newV = parseInt(match[3], 10) || 0;

      // Ahora solo busca "Tienda #2" en este pequeño fragmento, no en todo el texto general
      const tienda = segmento.includes("Tienda #2") ? "Tienda #2" : "Tienda #1";

      if (oldV > newV) {
        hasMatches = true;
        const cantidad = oldV - newV;

        for (let i = 0; i < cantidad; i++) {
          items.push(`- CAMISETA: ${nombreChema} talla ${talla}\nTIENDA: ${tienda}`);
        }
      }
    }
  });

  // Fallback si la expresión no encontró nada (ej. un ajuste general sin tallas)
  if (!hasMatches) {
    const tiendaF = detailsStr.includes("Tienda #1") ? "Tienda #1" : (detailsStr.includes("Tienda #2") ? "Tienda #2" : "General");
    items.push(`- CAMISETA: ${nombreChema}\nTIENDA: ${tiendaF}`);
  }

  return { cliente, vendedor, items };
}

function extractGuideData(log) {
  const data = parseLogDetails(log);
  return `CLIENTE: ${data.cliente}\n${data.items.join('\n')}\nVendedor: ${data.vendedor}`;
}

export default function HistoryPage({ isSuperUser = false }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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

  useEffect(() => {
    setSelectedLogs([]);
  }, [page, q, startDate, endDate, selectedUser, selectedStore, selectedType]);

  const fetchLogs = async (overrideStart, overrideEnd, overridePage, overrideUser, overrideStore, overrideQ, overrideType) => {
    setLoading(true);
    setErrMsg("");
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const currentPage = overridePage !== undefined ? overridePage : page;

      const finalStart = overrideStart !== undefined ? overrideStart : startDate;
      const finalEnd = overrideEnd !== undefined ? overrideEnd : endDate;
      const finalUser = overrideUser !== undefined ? overrideUser : selectedUser;
      const finalStore = overrideStore !== undefined ? overrideStore : selectedStore;
      const finalType = overrideType !== undefined ? overrideType : selectedType;
      const finalQ = overrideQ !== undefined ? overrideQ : q;

      const isFiltering = Boolean(finalStart || finalEnd || finalUser || finalStore || finalType || finalQ.trim());
      const limitVal = isFiltering ? "1000" : "30";

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: limitVal,
        _: String(Date.now()), 
      });

      if (finalStart) params.append("startDate", finalStart);
      if (finalEnd) params.append("endDate", finalEnd);
      if (finalUser) params.append("user", finalUser);
      if (finalStore) params.append("store", finalStore);
      if (finalType) params.append("type", finalType);
      if (finalQ.trim()) params.append("q", finalQ.trim());

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
    fetchLogs(undefined, undefined, 1);
    // eslint-disable-next-line
  }, [storedUser]); 

  const handleNextPage = () => {
    const next = Math.min(page + 1, totalPages);
    setPage(next);
    fetchLogs(undefined, undefined, next);
  };

  const handlePrevPage = () => {
    const prev = Math.max(page - 1, 1);
    setPage(prev);
    fetchLogs(undefined, undefined, prev);
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
      toastHOT.success("Historial eliminado correctamente.");
      setLogs([]);
      setTotalPages(1);
    } catch {
      toastHOT.error("No se pudo eliminar el historial.");
    } finally {
      setLoading(false);
    }
  }

  function askClear() {
    if (!isSuperUser || loading) return;
    toastHOT((t) => (
      <div className="text-center p-2">
        <p className="font-black text-gray-800 mb-3 text-sm sm:text-base">¿Eliminar todo el historial permanentemente?</p>
        <div className="mt-3 flex gap-2 justify-center">
          <button onClick={() => { toastHOT.dismiss(t.id); doClear(); }} className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-red-700 uppercase tracking-wider transition-colors">Eliminar Todo</button>
          <button onClick={() => toastHOT.dismiss(t.id)} className="bg-gray-100 text-gray-800 px-5 py-2.5 rounded-xl text-xs font-black hover:bg-gray-200 uppercase tracking-wider transition-colors">Cancelar</button>
        </div>
      </div>
    ), { duration: 6000 });
  }

  const handleClearFilters = () => {
    setStartDate(""); setEndDate(""); setSelectedUser(""); setSelectedStore(""); setSelectedType(""); setQ(""); setPage(1);
    fetchLogs("", "", 1, "", "", "", ""); 
    toastHOT.success("Filtros limpiados.", { duration: 1500 });
  };

  const toggleSelection = (id) => {
    setSelectedLogs(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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

    const finalString = `CLIENTE: ${cliente}\n${allItems.join('\n')}\nVendedor: ${vendedor}`;
    navigator.clipboard.writeText(finalString);
    
    toastHOT.success("Guía múltiple copiada. Lista para pegar.", { 
        id: "notificacion-copia-multiple",
        duration: 3000,
        style: { borderRadius: '12px', background: '#000', color: '#fff', fontSize: '12px', fontWeight: 'bold' }
    });
    
    setSelectedLogs([]); 
  };

  const uniqueUsers = useMemo(() => {
    const usersFromLogs = logs.map(l => l.user).filter(Boolean);
    return [...new Set([...BASE_USERS, ...usersFromLogs])].sort();
  }, [logs]);

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-32 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-4xl mx-auto">
        
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 bg-transparent hover:text-black transition-colors mb-8 font-bold uppercase tracking-widest text-xs cursor-pointer border-none"
        >
          <FaChevronLeft size={14} /> Volver al catálogo
        </button>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 mt-2">
            <div className="text-center sm:text-left">
              <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 shadow-sm">Administración</span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight tracking-tight">Historial de Registros</h2>
            </div>

            {isSuperUser && (
              <button
                onClick={askClear}
                disabled={loading || logs.length === 0}
                className="flex items-center gap-2 px-5 py-3 bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                title="Eliminar todos los registros"
              >
                <FaTrash size={12} /> Eliminar Historial
              </button>
            )}
          </div>

          <div className="animate-fade-in-up">
            <div className="bg-gray-50/80 p-3 sm:p-4 rounded-2xl border border-gray-100 mb-8 flex flex-col gap-3">
              
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="relative w-full">
                  <input 
                    type="text" 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPage(1);
                        fetchLogs(undefined, undefined, 1);
                      }
                    }}
                    placeholder="Buscar por producto o cliente..." 
                    className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-11 py-3 text-sm font-medium focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all" 
                  />
                  {q.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        setPage(1);
                        fetchLogs(undefined, undefined, 1, undefined, undefined, "");
                      }}
                      className="absolute right-3.5 top-2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center p-0 shadow-md shrink-0 transition-transform active:scale-90 z-10 cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <FaTimes className="w-3 h-3 text-white shrink-0 block" />
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => { setPage(1); fetchLogs(undefined, undefined, 1); }} 
                    className="flex-1 sm:flex-none px-6 py-3.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-colors shrink-0 cursor-pointer shadow-sm flex items-center justify-center gap-2"
                    title="Buscar"
                  >
                    <FaSearch size={12} />
                    <span>Buscar</span>
                  </button>

                  <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`px-5 py-3.5 rounded-xl border flex items-center justify-center transition-all shrink-0 cursor-pointer ${showFilters ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                    title="Filtros avanzados"
                  >
                    <FaFilter size={13} />
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-gray-200 animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row gap-3">
                      <div className="w-full"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Desde Fecha</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer" /></div>
                      <div className="w-full"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Hasta Fecha</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer" /></div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="w-full">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Empleado (Usuario)</label>
                      <select 
                        value={selectedUser} 
                        onChange={(e) => setSelectedUser(e.target.value)} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                      >
                        <option value="">Todos los empleados</option>
                        {uniqueUsers.map((u) => (<option key={u} value={u}>{u}</option>))}
                      </select>
                    </div>

                    <div className="w-full">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tienda</label>
                      <select 
                        value={selectedStore} 
                        onChange={(e) => setSelectedStore(e.target.value)} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                      >
                        <option value="">Todas</option>
                        <option value="Tienda #1">Tienda #1</option>
                        <option value="Tienda #2">Tienda #2</option>
                      </select>
                    </div>

                    <div className="w-full">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de Artículo</label>
                      <select 
                        value={selectedType} 
                        onChange={(e) => setSelectedType(e.target.value)} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all cursor-pointer"
                      >
                        <option value="">Todos los tipos</option>
                        <option value="Player">Player</option>
                        <option value="Niño">Niño</option>
                        <option value="Mujer">Mujer</option>
                        <option value="Abrigo">Abrigo</option>
                        <option value="Balón">Balón</option>
                        <option value="Fan">Fan</option>
                        <option value="Nacional">Nacional</option>
                        <option value="MLB">MLB</option>
                        <option value="Retro">Retro</option>
                        <option value="F1">F1</option>
                        <option value="NFL">NFL</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <button onClick={() => { setPage(1); fetchLogs(startDate, endDate, 1); }} className="w-full bg-black text-white border border-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-colors shadow-md cursor-pointer">Aplicar Filtros</button>
                    <button onClick={handleClearFilters} className="w-full bg-gray-100 text-gray-600 border border-gray-200 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors cursor-pointer">Limpiar</button>
                  </div>
                </div>
              )}
            </div>

            <div>
              {loading && <p className="text-gray-400 font-bold text-center py-6 uppercase tracking-widest text-xs">Cargando registros...</p>}
              {!loading && errMsg && <p className="text-red-500 font-bold text-center py-6 text-sm">{errMsg}</p>}

              {!loading && !errMsg && logs.length === 0 && (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100"><p className="text-gray-500 font-bold uppercase tracking-wide text-xs">No hay cambios registrados con estos criterios.</p></div>
              )}

              {!loading && !errMsg && logs.length > 0 && (
                <ul className="space-y-4">
                  {logs.map((log, idx) => {
                     const logDateObj = log.date ? new Date(log.date) : null;
                     const dateStr = logDateObj ? `${pad2(logDateObj.getDate())}/${pad2(logDateObj.getMonth()+1)}/${logDateObj.getFullYear()}` : "";
                     const timeStr = logDateObj ? logDateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
                     
                     const isSelected = selectedLogs.includes(log._id);

                     return (
                      <li key={log._id || idx} className={`relative bg-white border-2 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${isSelected ? 'border-black bg-gray-50' : 'border-gray-100'}`}>
                        
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="mt-1">
                              <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  onChange={() => toggleSelection(log._id)} 
                                  className="w-5 h-5 accent-black cursor-pointer"
                              />
                          </div>
                          <div className="w-full min-w-0">
                              <div className="mb-2"><strong className="text-gray-900 font-black text-sm">{log.user || "Desconocido"}</strong></div>
                              <em className="text-gray-800 font-bold block text-sm not-italic leading-tight">{log.item || "—"}</em>
                              <small className="flex items-center gap-1.5 text-gray-400 block mt-2 font-semibold text-xs"><FaCalendarAlt size={10} className="mb-0.5" />{dateStr} — {timeStr}</small>
                              
                              {log.details && (
                              <pre className="mt-4 bg-white border border-gray-200 p-4 rounded-xl text-[11px] overflow-hidden break-all whitespace-pre-wrap text-gray-600 font-mono shadow-inner">
                                  {(typeof log.details === "string" 
                                      ? log.details 
                                      : JSON.stringify(log.details, null, 2)
                                  ).replace(/\[ID:[^\]]+\]\s*\|\s*/g, "")}
                              </pre>
                              )}
                          </div>
                        </div>

                        {selectedLogs.length === 0 && (
                          <div className="sm:w-48 shrink-0 mt-2 sm:mt-0">
                              <button
                                  type="button"
                                  onClick={() => {
                                    const textoGuia = extractGuideData(log);
                                    navigator.clipboard.writeText(textoGuia);
                                    toastHOT.success("Guía copiada. Lista para pegar.", { 
                                        id: "notificacion-copia-individual",
                                        duration: 3000,
                                        style: { borderRadius: '12px', background: '#000', color: '#fff', fontSize: '12px', fontWeight: 'bold' }
                                    });
                                  }}
                                  className="w-full py-3 bg-black hover:bg-white hover:text-black rounded-xl text-[11px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border border-gray-200 text-white"
                              >
                                  <span>Copiar</span>
                              </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-gray-100">
                  <button onClick={handlePrevPage} disabled={page === 1} className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-xs font-bold disabled:opacity-30 flex items-center gap-2 cursor-pointer"><FaChevronLeft /> Anterior</button>
                  <span className="text-xs font-bold text-gray-500">Pág {page} de {totalPages}</span>
                  <button onClick={handleNextPage} disabled={page === totalPages} className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-xs font-bold disabled:opacity-30 flex items-center gap-2 cursor-pointer">Siguiente <FaChevronRight /></button>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {selectedLogs.length > 1 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
           <button 
                onClick={handleCopyMultiple} 
                className="bg-black text-white px-8 py-5 rounded-full shadow-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 hover:scale-105 transition-transform cursor-pointer"
           >
              JUNTAR Y COPIAR ({selectedLogs.length})
           </button>
        </div>
      )}

    </div>
  );
}