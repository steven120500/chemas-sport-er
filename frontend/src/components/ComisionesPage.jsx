import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronLeft, FaTrophy, FaCalendarAlt, FaSearch, 
  FaFilePdf, FaTrash, FaLock, FaExclamationTriangle
} from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  return `${y}-${m}`;
}

const BASE_USERS = ["Alisson", "Angie", "ChemaSportER", "Ema", "Johan", "Johanna", "Jose", "JuanPa", "Stef", "Melissa", "Ashly"];

function extractClienteSeguro(detailsStr) {
  if (typeof detailsStr !== "string") return "Cliente General";
  const idx = detailsStr.indexOf("Cliente:");
  if (idx === -1) return "Cliente General";
  
  const after = detailsStr.substring(idx + 8);
  const endIdx = after.indexOf("|");
  const raw = endIdx !== -1 ? after.substring(0, endIdx) : after;
  const clean = String(raw || "").trim();
  return clean || "Cliente General";
}

// 🛡️ PARSEO EXACTO DE MÚLTIPLES PRENDAS Y TALLAS
function parseSaleDetails(log) {
  const detailsStr = typeof log?.details === "string" 
    ? log.details 
    : JSON.stringify(log?.details || "");

  const cliente = extractClienteSeguro(detailsStr);
  const vendedor = String(log?.user || "Sistema").trim();
  const itemGeneral = String(log?.item || "Camiseta").trim();

  const items = [];
  const tallasAgrupadas = {};
  let totalUnidades = 0;

  try {
    const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/gi;
    let m;
    while ((m = regex.exec(detailsStr)) !== null) {
      const [, tallaCapturada, oldStr, newStr] = m;
      const talla = String(tallaCapturada || "U").trim();
      const oldV = parseInt(oldStr, 10) || 0;
      const newV = parseInt(newStr, 10) || 0;

      const subStr = detailsStr.substring(0, m.index);
      const tienda = subStr.includes("Tienda #2") ? "Tienda #2" : "Tienda #1";

      if (oldV > newV) {
        const cantidad = oldV - newV;
        totalUnidades += cantidad;
        tallasAgrupadas[talla] = (tallasAgrupadas[talla] || 0) + cantidad;
        
        for (let i = 0; i < cantidad; i++) {
          items.push({ tienda, talla, nombre: itemGeneral });
        }
      }
    }
  } catch (e) {
    console.error("Error al procesar tallas:", e);
  }

  // Fallback si fue venta directa sin formato de tallas
  if (items.length === 0 && String(log?.action || "").toLowerCase().includes("vend")) {
    items.push({ tienda: "Tienda #1", talla: "U", nombre: itemGeneral });
    tallasAgrupadas["U"] = 1;
    totalUnidades = 1;
  }

  const tallasTexto = Object.entries(tallasAgrupadas)
    .map(([talla, cant]) => (cant > 1 ? `${cant}x ${talla}` : `${talla}`))
    .join(", ");

  return { cliente, vendedor, items, totalUnidades, tallasTexto, rawDetails: detailsStr };
}

export default function ComisionesPage({ isSuperUser = false, user = null }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => ymLocal());
  const [searchFilter, setSearchFilter] = useState("");
  const [comisionPorPrenda, setComisionPorPrenda] = useState(800);

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const roles = Array.isArray(storedUser?.roles) ? storedUser.roles.join(",") : "";
      const params = new URLSearchParams({
        page: "1",
        limit: "3000",
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

  const ventasFiltradas = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs
      .map((log) => {
        const parsed = parseSaleDetails(log);
        const actionStr = String(log?.action || "").toLowerCase();
        const detailsStr = String(log?.details || "").toLowerCase();

        const esVenta = 
          actionStr.includes("vend") || 
          (parsed.totalUnidades > 0 && !actionStr.includes("ajust") && !actionStr.includes("actualiz") && !detailsStr.includes("ajuste"));

        return { ...log, ...parsed, esVenta };
      })
      .filter((v) => v.esVenta && v.totalUnidades > 0);
  }, [logs]);

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
      .filter((item) => storedUser?.isSuperUser || item.unidades > 0)
      .sort((a, b) => b.unidades - a.unidades);
  }, [ventasFiltradas, comisionPorPrenda, storedUser?.isSuperUser]);

  const tablaVentas = useMemo(() => {
    if (!searchFilter.trim()) return ventasFiltradas;
    const q = searchFilter.toLowerCase();
    return ventasFiltradas.filter((v) =>
      v.vendedor.toLowerCase().includes(q) ||
      v.cliente.toLowerCase().includes(q) ||
      String(v.item || "").toLowerCase().includes(q)
    );
  }, [ventasFiltradas, searchFilter]);

  const top1 = ranking.at(0) || null;
  const top2 = ranking.at(1) || null;
  const top3 = ranking.at(2) || null;
  const restoRanking = ranking.slice(3);

  const totalPrendasMes = ventasFiltradas.reduce((acc, v) => acc + v.totalUnidades, 0);
  const totalComisionesMes = totalPrendasMes * comisionPorPrenda;

  const ejecutarResetGlobal = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "x-super": storedUser?.isSuperUser ? "true" : "false"
        }
      });

      if (!res.ok) throw new Error("Error en el servidor al reiniciar");

      setLogs([]);
      toastHOT.success("Historial reiniciado. Comisiones puestas en cero.", {
        style: { background: "#000", color: "#fff", fontWeight: "bold" }
      });
    } catch (err) {
      console.error(err);
      toastHOT.error("No se pudo reiniciar el historial.");
    }
  };

  const confirmarResetGlobal = () => {
    toastHOT((t) => (
      <div className="text-center p-2 text-black font-sans">
        <div className="flex justify-center text-red-600 mb-2">
          <FaExclamationTriangle size={24} />
        </div>
        <p className="font-black text-sm mb-1 text-red-600 uppercase tracking-widest">¿Reiniciar todo el mes?</p>
        <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
          Esto eliminará <strong>absolutamente todas</strong> las ventas y pondrá a todos los vendedores en cero. <br/><br/>
          <span className="font-bold text-black">Ojo:</span> Esta acción no afecta el stock, solo limpia la tabla de comisiones. No se puede deshacer.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              toastHOT.dismiss(t.id);
              ejecutarResetGlobal();
            }}
            className="bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer shadow-md"
          >
            SÍ, BORRAR TODO
          </button>
          <button
            onClick={() => toastHOT.dismiss(t.id)}
            className="bg-zinc-100 text-zinc-700 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer"
          >
            CANCELAR
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  // 🗑️ LÓGICA DE ANULACIÓN BLINDADA (Llama a /sales o /products)
  const ejecutarAnulacion = async (venta) => {
    try {
      const payload = {
        item: venta.item,
        items: venta.items || [],
        totalUnidades: venta.totalUnidades || 1
      };

      // 1. Intenta en /api/sales/anular/
      let res = await fetch(`${API_BASE}/api/sales/anular/${venta._id}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-super": storedUser?.isSuperUser ? "true" : "false"
        },
        body: JSON.stringify(payload)
      });

      // 2. Si no responde /api/sales, intenta en /api/products/anular/
      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_BASE}/api/products/anular/${venta._id}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-super": storedUser?.isSuperUser ? "true" : "false"
          },
          body: JSON.stringify(payload)
        });
      }

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.error || `Error ${res.status} del servidor`);
      }

      // Elimina la fila y descuenta del podio de comisiones al instante
      setLogs((prev) => prev.filter((l) => l._id !== venta._id));
      toastHOT.success("Venta anulada. Camisetas devueltas al inventario.", {
        style: { background: "#000", color: "#fff", fontWeight: "bold" }
      });
    } catch (err) {
      console.error("Error al anular:", err);
      toastHOT.error(err.message || "No se pudo anular la venta.");
    }
  };

  const confirmarAnulacion = (venta) => {
    toastHOT((t) => (
      <div className="text-center p-2 text-black font-sans">
        <p className="font-black text-sm mb-1">¿Anular esta venta?</p>
        <p className="text-xs text-zinc-600 mb-3">
          Se sumarán <strong>{venta.totalUnidades} camiseta(s)</strong> ({venta.tallasTexto || "talla vendida"}) al stock y se descontará del vendedor <strong>{venta.vendedor}</strong>.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              toastHOT.dismiss(t.id);
              ejecutarAnulacion(venta);
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 cursor-pointer"
          >
            Sí, Anular
          </button>
          <button
            onClick={() => toastHOT.dismiss(t.id)}
            className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const generarPDFBlancoYNegro = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor permite las ventanas emergentes para generar el PDF.");

    const fechaHoy = new Date().toLocaleDateString("es-CR");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Comisiones - ${selectedMonth} - Chema Sport ER</title>
          <style>
            @page { size: letter; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000; background: #fff; margin: 0; padding: 0; font-size: 11px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 11px; color: #444; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; }
            .meta { text-align: right; font-size: 10px; color: #333; }
            
            .summary-box { display: flex; border: 1px solid #000; margin-bottom: 25px; }
            .summary-item { flex: 1; padding: 10px 15px; border-right: 1px solid #000; }
            .summary-item:last-child { border-right: none; }
            .summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
            .summary-value { font-size: 18px; font-weight: 900; margin-top: 4px; }

            .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-top: 25px; margin-bottom: 10px; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #000; padding: 6px 4px; }
            td { padding: 6px 4px; border-bottom: 1px solid #e0e0e0; font-size: 10px; }
            tr:last-child td { border-bottom: 1px solid #000; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 800; }

            .footer { margin-top: 35px; border-top: 1px solid #000; padding-top: 8px; font-size: 9px; text-align: center; text-transform: uppercase; letter-spacing: 1px; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">CHEMA SPORT ER</h1>
              <p class="subtitle">Liquidación de Ventas y Comisiones</p>
            </div>
            <div class="meta">
              <p><strong>Mes:</strong> ${selectedMonth}</p>
              <p><strong>Fecha de Emisión:</strong> ${fechaHoy}</p>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-label">Prendas Vendidas</div>
              <div class="summary-value">${totalPrendasMes} uds.</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Comisiones</div>
              <div class="summary-value">₡${totalComisionesMes.toLocaleString("es-CR")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Tarifa por Prenda</div>
              <div class="summary-value">₡${comisionPorPrenda.toLocaleString("es-CR")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Líder del Mes</div>
              <div class="summary-value">${top1?.vendedor || "N/A"} (${top1?.unidades || 0})</div>
            </div>
          </div>

          <div class="section-title">1. Resumen por Vendedor</div>
          <table>
            <thead>
              <tr>
                <th style="width: 10%;">Pos.</th>
                <th style="width: 45%;">Vendedor</th>
                <th class="text-right" style="width: 20%;">Prendas</th>
                <th class="text-right" style="width: 25%;">Total Comisión</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((r, i) => `
                <tr>
                  <td class="font-bold">${i + 1}º</td>
                  <td class="font-bold">${r.vendedor}</td>
                  <td class="text-right">${r.unidades}</td>
                  <td class="text-right font-bold">₡${r.totalComision.toLocaleString("es-CR")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">2. Registro Detallado de Ventas</div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Fecha</th>
                <th style="width: 20%;">Vendedor</th>
                <th style="width: 25%;">Cliente</th>
                <th style="width: 30%;">Artículo / Tallas</th>
                <th class="text-right" style="width: 10%;">Cant.</th>
              </tr>
            </thead>
            <tbody>
              ${ventasFiltradas.map((v) => {
                const d = v.date ? new Date(v.date) : null;
                const fStr = d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` : "-";
                return `
                  <tr>
                    <td>${fStr}</td>
                    <td class="font-bold">${v.vendedor}</td>
                    <td>${v.cliente}</td>
                    <td>${v.item}${v.tallasTexto ? ` (${v.tallasTexto})` : ""}</td>
                    <td class="text-right font-bold">${v.totalUnidades}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div class="footer">
            Chema Sport ER — Documento Oficial de Rendición de Cuentas
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-zinc-50 pt-36 pb-32 px-4 sm:px-6 lg:px-8 font-sans text-black relative">
      <div className="max-w-6xl mx-auto">
          
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 bg-black border border-gray-600 text-zinc-300 hover:text-white hover:bg-zinc-800 px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-sm cursor-pointer transition-all mb-8"
        >
          <FaChevronLeft size={12} /> Volver al catálogo
        </button>

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
              Registro de ventas y comisiones acumuladas del mes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {storedUser?.isSuperUser && (
              <button
                onClick={confirmarResetGlobal}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black uppercase tracking-wider px-5 py-3 rounded-2xl shadow-sm transition-all cursor-pointer border border-red-200"
                title="Borrar todo el historial de ventas del mes"
              >
                <FaTrash size={14} />
                <span className="hidden sm:inline">Reiniciar</span>
              </button>
            )}

            <button
              onClick={generarPDFBlancoYNegro}
              className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-2xl shadow-md transition-all cursor-pointer"
            >
              <FaFilePdf size={14} />
              <span>Exportar PDF</span>
            </button>

            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 rounded-2xl">
              <FaCalendarAlt className="text-zinc-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-black text-black outline-none cursor-pointer"
              />
            </div>

            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border ${storedUser?.isSuperUser ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-100 border-zinc-200 opacity-80'}`}>
              {!storedUser?.isSuperUser ? (
                <FaLock className="text-zinc-400" size={10} title="Solo administradores" />
              ) : (
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">₡/Prenda:</span>
              )}
              <input
                type="number"
                min="0"
                step="100"
                value={comisionPorPrenda}
                onChange={(e) => setComisionPorPrenda(Number(e.target.value) || 0)}
                disabled={!storedUser?.isSuperUser}
                className={`w-20 bg-transparent text-sm font-black text-black outline-none ${!storedUser?.isSuperUser ? 'cursor-not-allowed text-zinc-500 select-none' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* Podio Top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 items-end">
          
          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-2 md:order-1">
            <div className="w-12 h-12 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xl font-black mb-3 shadow-inner">
              🥈
            </div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">2º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">
              {top2?.vendedor || "Sin ventas"}
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

          <div className="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-3xl p-7 border-2 border-amber-400 shadow-xl flex flex-col items-center text-center relative order-1 md:order-2 -mt-4 md:-mt-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-black flex items-center justify-center text-3xl font-black mb-3 shadow-md">
              🥇
            </div>
            <span className="text-xs font-black tracking-widest text-amber-600 uppercase flex items-center gap-1">
              ★ LÍDER EN VENTAS ★
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-black mt-1 truncate max-w-full">
              {top1?.vendedor || "Sin ventas"}
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

          <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm flex flex-col items-center text-center relative order-3">
            <div className="w-12 h-12 rounded-full bg-amber-700/20 text-amber-800 flex items-center justify-center text-xl font-black mb-3 shadow-inner">
              🥉
            </div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">3º LUGAR</span>
            <h3 className="text-xl font-black text-black mt-1 truncate max-w-full">
              {top3?.vendedor || "Sin ventas"}
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

        {/* Resto del ranking */}
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

        {/* Tabla de ventas */}
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
                    <th className="py-3 px-3">Artículo / Tallas</th>
                    <th className="py-3 px-3">Tienda</th>
                    <th className="py-3 px-3 text-right">Cant.</th>
                    <th className="py-3 px-3 text-center">Anular</th>
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

                    // Permiso para anular
                    const canDelete = Boolean(
                      storedUser?.isSuperUser ||
                      (storedUser?.roles || []).includes("admin") ||
                      (storedUser?.roles || []).includes("history") ||
                      String(storedUser?.username || "").toLowerCase() === String(venta.vendedor || "").toLowerCase()
                    );

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
                          <span className="font-bold text-black block">{venta.item}</span>
                          {venta.tallasTexto && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 font-mono text-[10px] font-bold">
                              Tallas: {venta.tallasTexto}
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

                        <td className="py-3.5 px-3 text-center">
                          {canDelete ? (
                            <button
                              onClick={() => confirmarAnulacion(venta)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                              title="Anular venta y restablecer inventario"
                            >
                              <FaTrash size={13} />
                            </button>
                          ) : (
                            <div className="p-2 text-zinc-300" title="Solo el creador o SuperAdmin pueden anular">
                              <FaLock size={11} />
                            </div>
                          )}
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