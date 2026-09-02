import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaTrophy, FaMedal, FaSearch, 
  FaCalendarAlt, FaStore, FaMoneyBillWave, FaTshirt 
} from "react-icons/fa";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  return `${y}-${m}`;
}

const BASE_USERS = ["Alisson", "Angie", "ChemaSportER", "Ema", "Johan", "Johanna", "Jose", "JuanPa", "Stef", "Stefanie"];

// Parsea los detalles del log para extraer cliente, vendedor, prendas y cantidades
function parseSaleDetails(log) {
  const detailsStr = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");

  let cliente = "Cliente General";
  const matchCliente = detailsStr.match(/Cliente:\s*([^|]+)/i);
  if (matchCliente && matchCliente) cliente = matchCliente.trim();

  const vendedor = log.user || "Sistema";
  const itemGeneral = log.item || "Camiseta";

  const regex = /(Tienda #)\[(.*?)\]:\s*(\d+)\s*(?:->|→)\s*(\d+)/g;
  let match;
  const items = [];
  let totalUnidades = 0;

  while ((match = regex.exec(detailsStr)) !== null) {
    const tienda = match;
    const talla = match;
    const oldV = parseInt(match, 10);
    const newV = parseInt(match, 10);

    if (oldV > newV) {
      const cantidad = oldV - newV;
      totalUnidades += cantidad;
      for (let i = 0; i < cantidad; i++) {
        items.push({ tienda, talla, nombre: itemGeneral });
      }
    }
  }

  // Si no hubo formato de tallas pero fue marcado como venta
  if (items.length === 0 && (log.action || "").toLowerCase().includes("vend")) {
    items.push({ tienda: "Tienda #1", talla: "U", nombre: itemGeneral });
    totalUnidades = 1;
  }

  return { cliente, vendedor, items, totalUnidades };
}

export default function ComisionesPage({ isSuperUser = false, user = null }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => ymLocal());
  const [searchFilter, setSearchFilter] = useState("");
  const [comisionPorPrenda, setComisionPorPrenda] = useState(1000); // ₡1.000 por defecto por camiseta

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Carga de historial desde el backend
  const fetchVentas = async () => {
    setLoading(true);
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const params = new URLSearchParams({
        page: "1",
        limit: "2000",
        month: selectedMonth,
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
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setLogs(items);
    } catch (err) {
      console.error("Error cargando ventas:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedMonth]);

  // Filtramos solo los registros que representen ventas reales
  const ventasFiltradas = useMemo(() => {
    return logs
      .map((log) => {
        const parsed = parseSaleDetails(log);
        const actionStr = String(log.action || "").toLowerCase();
        const detailsStr = String(log.details || "").toLowerCase();

        // Es venta si la acción lo dice o si tiene cliente asignado que no sea ajuste
        const esVenta = 
          actionStr.includes("vend") || 
          (parsed.totalUnidades > 0 && !detailsStr.includes("ajuste de inventario"));

        return { ...log, ...parsed, esVenta };
      })
      .filter((v) => v.esVenta && v.totalUnidades > 0);
  }, [logs]);

  // 🏆 Cálculo del Ranking por Vendedor
  const ranking = useMemo(() => {
    const conteo = {};
    BASE_USERS.forEach((u) => (conteo[u] = { ventas: 0, unidades: 0 }));

    ventasFiltradas.forEach((v) => {
      const vend = v.vendedor || "Otros";
      if (!conteo[vend]) {
        conteo[vend] = { ventas: 0, unidades: 0 };
      }
      conteo[vend].ventas += 1;
      conteo[vend].unidades += v.totalUnidades;
    });

    return Object.entries(conteo)
      .map(([vendedor, stats]) => ({
        vendedor,
        ventas: stats.ventas,
        unidades: stats.unidades,
        totalComision: stats.unidades * comisionPorPrenda,
      }))
      .filter((item) => isSuperUser || item.unidades > 0)
      .sort((a, b) => b.unidades - a.unidades);
  }, [ventasFiltradas, comisionPorPrenda, isSuperUser]);

  // Lista de ventas para la tabla inferior con buscador
  const tablaVentas = useMemo(() => {
    if (!searchFilter.trim()) return ventasFiltradas;
    const q = searchFilter.toLowerCase();
    return ventasFiltradas.filter((v) =>
      v.vendedor.toLowerCase().includes(q) ||
      v.cliente.toLowerCase().includes(q) ||
      (v.item || "").toLowerCase().includes(q)
    );
  }, [ventasFiltradas, searchFilter]);

  const top1 = ranking[0];
  const top2 = ranking;
  const top3 = ranking;
  const restoRanking = ranking.slice(3);

  const totalPrendasMes = ventasFiltradas.reduce((acc, v) => acc + v.totalUnidades, 0);
  const totalComisionesMes = totalPrendasMes * comisionPorPrenda;

  return (
    <div className="min-h-screen bg-zinc-50 pt-8 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        
        {/* 🔙 Botón Volver */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-zinc-500 hover:text-black transition-colors mb-6 font-bold uppercase tracking-widest text-xs cursor-pointer bg-transparent border-0"
        >
          <FaChevronLeft size={13} /> Volver al catálogo
        </button>

        {/* ========================================================
            🏆 CABECERA Y FILTRO DE MES
            ======================================================== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest mb-3 shadow-sm">
              <FaTrophy size={11} className="text-amber-400" />
              <span>TABLERO DE COMISIONES</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
              Ranking de Vendedores
            </h1>
            <p className="text-zinc-500 text-sm font-medium mt-1">
              Registro de ventas y cálculo de comisiones por prendas vendidas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Mes */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2 rounded-2xl">
              <FaCalendarAlt className="text-zinc-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-black text-black outline-none cursor-pointer"
              />
            </div>

            {/* Ajuste de Comisión por Prenda (Editable) */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2 rounded-2xl">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">₡/Prenda:</span>
              <input
                type="number"
                min="0"
                step="100"
                value={comisionPorPrenda}
                onChange={(e) => setComisionPorPrenda(Number(e.target.value) || 0)}
                className="w-20 bg-transparent text-sm font-black text-black outline-none"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            🥇 PODIO DEL TOP 3 (TARJETAS GRANDES)
            ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 items-end">
          
          {/* 🥈 SEGUNDO LUGAR */}
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-2 md:order-1">
            <div className="w-12 h-12 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xl font-black mb-3 shadow-inner">
              🥈
            </div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">2º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">
              {top2?.vendedor || "Sin datos"}
            </h3>
            <div className="mt-4 w-full bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
              <p className="text-3xl font-black text-black leading-none">
                {top2?.unidades || 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Prendas vendidas</p>
              <p className="text-sm font-black text-emerald-600 mt-2">
                ₡{(top2?.totalComision || 0).toLocaleString("es-CR")}
              </p>
            </div>
          </div>

          {/* 🥇 PRIMER LUGAR (MÁS ALTO Y DESTACADO) */}
          <div className="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-3xl p-7 border-2 border-amber-400 shadow-xl flex flex-col items-center text-center relative order-1 md:order-2 -mt-4 md:-mt-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-black flex items-center justify-center text-3xl font-black mb-3 shadow-md">
              🥇
            </div>
            <span className="text-xs font-black tracking-widest text-amber-600 uppercase flex items-center gap-1">
              ★ LÍDER EN VENTAS ★
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-black mt-1 truncate max-w-full">
              {top1?.vendedor || "Sin datos"}
            </h3>
            <div className="mt-4 w-full bg-amber-50/60 rounded-2xl p-4 border border-amber-200">
              <p className="text-4xl font-black text-black leading-none">
                {top1?.unidades || 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Prendas vendidas</p>
              <p className="text-lg font-black text-emerald-600 mt-2">
                ₡{(top1?.totalComision || 0).toLocaleString("es-CR")}
              </p>
              <span className="text-[10px] font-bold text-zinc-400">Total comisiones</span>
            </div>
          </div>

          {/* 🥉 TERCER LUGAR */}
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-3">
            <div className="w-12 h-12 rounded-full bg-amber-700/20 text-amber-800 flex items-center justify-center text-xl font-black mb-3 shadow-inner">
              🥉
            </div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">3º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">
              {top3?.vendedor || "Sin datos"}
            </h3>
            <div className="mt-4 w-full bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
              <p className="text-3xl font-black text-black leading-none">
                {top3?.unidades || 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Prendas vendidas</p>
              <p className="text-sm font-black text-emerald-600 mt-2">
                ₡{(top3?.totalComision || 0).toLocaleString("es-CR")}
              </p>
            </div>
          </div>

        </div>

        {/* 📊 RESTO DEL RANKING (Posición 4 en adelante) */}
        {restoRanking.length > 0 && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 mb-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 ml-1">
              Posiciones Generales
            </h3>
            <div className="divide-y divide-zinc-100">
              {restoRanking.map((item, idx) => (
                <div key={item.vendedor} className="py-3.5 flex items-center justify-between hover:bg-zinc-50 px-3 rounded-xl transition-colors">
                  <div className="flex items-center gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-zinc-100 font-black text-xs text-zinc-700 flex items-center justify-center">
                      {idx + 4}
                    </span>
                    <span className="font-black text-sm text-black">{item.vendedor}</span>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <span className="font-black text-base text-black">{item.unidades}</span>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase ml-1">prendas</span>
                    </div>
                    <span className="font-black text-sm text-emerald-600 min-w-[90px]">
                      ₡{item.totalComision.toLocaleString("es-CR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            📋 TABLA DETALLADA DE HISTORIAL DE VENTAS
            ======================================================== */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                Detalle de Ventas del Periodo
              </h2>
              <p className="text-zinc-400 text-xs font-medium mt-0.5">
                {tablaVentas.length} ventas registradas este mes ({totalPrendasMes} prendas en total).
              </p>
            </div>

            {/* Buscador de la tabla */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar por cliente o vendedor..."
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-black outline-none focus:border-black transition-colors"
              />
              <FaSearch size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            </div>
          </div>

          {loading ? (
            <p className="text-center py-12 text-zinc-400 font-bold text-xs uppercase tracking-widest">
              Cargando ventas del mes...
            </p>
          ) : tablaVentas.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-wider">
                No hay ventas registradas en el mes de {selectedMonth}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 uppercase tracking-wider font-black text-[10px]">
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Vendedor</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Prenda / Talla</th>
                    <th className="py-3 px-3">Tienda</th>
                    <th className="py-3 px-3 text-right">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {tablaVentas.map((venta) => {
                    const dateObj = venta.date ? new Date(venta.date) : null;
                    const dateStr = dateObj
                      ? `${pad2(dateObj.getDate())}/${pad2(dateObj.getMonth() + 1)}`
                      : "";
                    const timeStr = dateObj
                      ? dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "";

                    return (
                      <tr key={venta._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3.5 px-3 text-zinc-500 whitespace-nowrap">
                          {dateStr} <span className="text-[10px] text-zinc-400">{timeStr}</span>
                        </td>
                        <td className="py-3.5 px-3 font-black text-black">
                          {venta.vendedor}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-zinc-800">
                          {venta.cliente}
                        </td>
                        <td className="py-3.5 px-3 text-zinc-700">
                          <span className="font-bold text-black">{venta.item}</span>
                          {venta.items && venta.items.length > 0 && (
                            <span className="block text-[10px] text-zinc-400 font-mono">
                              Tallas: {venta.items.map((i) => i.talla).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold">
                            {venta.items[0]?.tienda || "Tienda #1"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-black text-right text-sm text-black">
                          {venta.totalUnidades}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}