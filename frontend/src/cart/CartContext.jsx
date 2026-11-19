import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { CartContext, EVENTO_APARTADAS } from "./useCart";
import { API_BASE } from "../authFetch";

// 🛒 Carrito de compras del cliente (vive en el navegador, en localStorage).
// Cada línea = producto + talla + dorsal. La misma camiseta en otra talla o con otro dorsal es otra línea.
// ⚠️ El precio guardado es solo referencia: al pagar (Tilopay) el backend lo recalcula desde la BD.
//
// ⏳ APARTADO: al agregar una camiseta se aparta en el servidor por 10 min (PUT /api/checkout/reservas).
// Mientras tanto ningún otro cliente puede llevarse esa unidad. Al vencer, la línea sale sola del carrito.
// Todas las líneas del mismo producto+talla comparten una sola reserva (con la suma de las cantidades).

const STORAGE_KEY = "chemasport_carrito";
const CARRITO_ID_KEY = "chemasport_carrito_id";
const MAX_POR_LINEA = 10;
const ESTILO_TOAST = { borderRadius: "12px", background: "#000", color: "#fff" };

const leerGuardado = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter((l) => l && l.productId && l.talla && l.cantidad > 0) : [];
  } catch {
    return [];
  }
};

// 🔑 Id aleatorio del carrito (las reservas del servidor se agrupan por este id)
const leerCarritoId = () => {
  const nuevo = () => {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  try {
    let id = localStorage.getItem(CARRITO_ID_KEY);
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(id || "")) {
      id = nuevo();
      localStorage.setItem(CARRITO_ID_KEY, id);
    }
    return id;
  } catch {
    return nuevo();
  }
};

const claveDe = (productId, talla, dorsal) =>
  [productId, talla, dorsal ? `${dorsal.name || ""}#${dorsal.number || ""}` : "lisa"].join("|");
const grupoDe = (productId, talla) => `${productId}|${talla}`;
const totalGrupo = (items, productId, talla) =>
  items.filter((l) => l.productId === productId && l.talla === talla).reduce((s, l) => s + l.cantidad, 0);
const nombreTalla = (t) => (t === "U" ? "única" : t);

// Hora del servidor → hora de este celular (por si el reloj del teléfono está corrido)
const aLocal = (expiresAt, ahoraServidor) =>
  Date.now() + (new Date(expiresAt).getTime() - (Number(ahoraServidor) || Date.now()));

async function apartarEnServidor(carritoId, productId, talla, cantidad) {
  const r = await fetch(`${API_BASE}/api/checkout/reservas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carritoId, productId, talla, cantidad }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "No se pudo apartar la camiseta.");
    err.libres = data.libres;
    err.status = r.status;
    throw err;
  }
  return data;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(leerGuardado);
  const [open, setOpen] = useState(false);
  const [apartadasTodas, setApartadasTodas] = useState({}); // { productId: { talla: n } } de TODOS los carritos
  const carritoId = useRef(leerCarritoId()).current;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 💾 Guardar en cada cambio
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* modo privado / sin espacio: el carrito sigue en memoria */
    }
  }, [items]);

  // 🔄 Sincronizar entre pestañas abiertas
  useEffect(() => {
    const onStorage = (e) => e.key === STORAGE_KEY && setItems(leerGuardado());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Pone la misma hora de vencimiento a todas las líneas de ese producto+talla
  const ponerVence = useCallback((productId, talla, venceAt) => {
    setItems((prev) => prev.map((l) => (l.productId === productId && l.talla === talla ? { ...l, venceAt } : l)));
  }, []);

  // 🌐 Al abrir la página: qué reservas siguen vivas en el servidor (las vencidas salen del carrito)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [rRes, rAp] = await Promise.all([
          fetch(`${API_BASE}/api/checkout/reservas/${carritoId}`),
          fetch(`${API_BASE}/api/checkout/apartadas`),
        ]);
        const ap = await rAp.json().catch(() => ({}));
        if (vivo && rAp.ok) setApartadasTodas(ap || {});
        if (!rRes.ok) return; // sin conexión: no se toca el carrito
        const { reservas = [], ahora: ahoraServidor } = await rRes.json();
        if (!vivo) return;
        const vivas = new Map(reservas.map((r) => [grupoDe(String(r.productId), r.talla), aLocal(r.expiresAt, ahoraServidor)]));
        const vencidas = itemsRef.current.filter((l) => !vivas.has(grupoDe(l.productId, l.talla)));
        setItems((prev) =>
          prev
            .filter((l) => vivas.has(grupoDe(l.productId, l.talla)))
            .map((l) => ({ ...l, venceAt: vivas.get(grupoDe(l.productId, l.talla)) }))
        );
        if (vencidas.length) {
          toastHOT(`⏳ Pasaron los 10 minutos: liberamos ${vencidas.length === 1 ? vencidas[0].name : `${vencidas.length} camisetas`} de tu carrito.`, { duration: 6000, style: ESTILO_TOAST });
        }
      } catch {
        /* sin conexión: se deja como está */
      }
    })();
    return () => { vivo = false; };
  }, [carritoId]);

  // ⏱️ Cada segundo mientras haya algo apartado: lo vencido sale del carrito.
  // (El contador que se ve en pantalla usa useCuentaAtras, así no se repinta toda la app cada segundo)
  const hayApartadas = items.some((l) => l.venceAt);
  useEffect(() => {
    if (!hayApartadas) return;
    const t = setInterval(() => {
      const n = Date.now();
      const vencidas = itemsRef.current.filter((l) => l.venceAt && l.venceAt <= n);
      if (!vencidas.length) return;
      setItems((prev) => prev.filter((l) => !(l.venceAt && l.venceAt <= n)));
      const nombres = [...new Set(vencidas.map((l) => `${l.name} (talla ${nombreTalla(l.talla)})`))];
      toastHOT(`⏳ Se acabó el tiempo de apartado: liberamos ${nombres.join(", ")}.`, { duration: 7000, style: ESTILO_TOAST });
    }, 1000);
    return () => clearInterval(t);
  }, [hayApartadas]);

  // 📡 App reenvía el evento del socket ('apartadasActualizadas') como evento del navegador
  useEffect(() => {
    const on = (e) => {
      const { productId, apartadas } = e.detail || {};
      if (productId) setApartadasTodas((prev) => ({ ...prev, [String(productId)]: apartadas || {} }));
    };
    window.addEventListener(EVENTO_APARTADAS, on);
    return () => window.removeEventListener(EVENTO_APARTADAS, on);
  }, []);

  // Cuántas tienen apartadas OTROS clientes (lo mío no me resta)
  const otrasApartadas = useCallback(
    (productId, talla) => {
      const todas = Number(apartadasTodas?.[String(productId)]?.[talla]) || 0;
      const mias = items
        .filter((l) => l.productId === String(productId) && l.talla === talla && l.venceAt)
        .reduce((s, l) => s + l.cantidad, 0);
      return Math.max(0, todas - mias);
    },
    [apartadasTodas, items]
  );

  const avisarError = (err) => toastHOT.error(err.message, { duration: 6000, style: ESTILO_TOAST });

  /** Agrega y aparta. Devuelve true si se pudo. */
  const agregar = useCallback(
    async ({ productId, name, type, image, talla, dorsal = null, precio, precioAntes = 0, cantidad = 1 }) => {
      productId = String(productId);
      const key = claveDe(productId, talla, dorsal);
      const actual = itemsRef.current;
      const linea = actual.find((l) => l.key === key);
      const suma = Math.min(cantidad, MAX_POR_LINEA - (linea?.cantidad || 0));
      if (suma <= 0) {
        toastHOT.error(`Máximo ${MAX_POR_LINEA} por camiseta.`, { style: ESTILO_TOAST });
        return false;
      }
      try {
        const r = await apartarEnServidor(carritoId, productId, talla, totalGrupo(actual, productId, talla) + suma);
        const venceAt = aLocal(r.expiresAt, r.ahora);
        setItems((prev) => {
          const existe = prev.find((l) => l.key === key);
          const nuevas = existe
            ? prev.map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + suma, precio, precioAntes } : l))
            : [...prev, { key, productId, name, type, image, talla, dorsal, precio, precioAntes, cantidad: suma }];
          return nuevas.map((l) => (l.productId === productId && l.talla === talla ? { ...l, venceAt } : l));
        });
        return true;
      } catch (err) {
        avisarError(err);
        return false;
      }
    },
    [carritoId]
  );

  const cambiarCantidad = useCallback(
    async (key, cantidad) => {
      const actual = itemsRef.current;
      const linea = actual.find((l) => l.key === key);
      if (!linea) return;
      const nueva = Math.max(0, Math.min(MAX_POR_LINEA, cantidad));
      const total = totalGrupo(actual, linea.productId, linea.talla) - linea.cantidad + nueva;

      if (nueva > linea.cantidad) {
        // ➕ Primero se aparta; si no hay, no se suma
        try {
          const r = await apartarEnServidor(carritoId, linea.productId, linea.talla, total);
          setItems((prev) => prev.map((l) => (l.key === key ? { ...l, cantidad: nueva } : l)));
          ponerVence(linea.productId, linea.talla, aLocal(r.expiresAt, r.ahora));
        } catch (err) {
          avisarError(err);
        }
        return;
      }
      // ➖ Se baja de una y se suelta en el servidor
      setItems((prev) => (nueva <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, cantidad: nueva } : l))));
      apartarEnServidor(carritoId, linea.productId, linea.talla, total).catch(() => {});
    },
    [carritoId, ponerVence]
  );

  const quitar = useCallback((key) => cambiarCantidad(key, 0), [cambiarCantidad]);

  // Vacía y suelta todo (después de pagar el servidor ya las soltó: no pasa nada)
  const vaciar = useCallback(() => {
    const grupos = new Map(itemsRef.current.map((l) => [grupoDe(l.productId, l.talla), l]));
    setItems([]);
    for (const l of grupos.values()) apartarEnServidor(carritoId, l.productId, l.talla, 0).catch(() => {});
  }, [carritoId]);

  const value = useMemo(() => {
    const count = items.reduce((s, l) => s + l.cantidad, 0);
    const subtotal = items.reduce((s, l) => s + l.cantidad * (Number(l.precio) || 0), 0);
    const vencimientos = items.map((l) => l.venceAt).filter(Boolean);
    const proximoVence = vencimientos.length ? Math.min(...vencimientos) : null;
    return {
      items,
      count,
      subtotal,
      open,
      carritoId,
      proximoVence, // ms del primer apartado que vence (para el contador)
      abrir: () => setOpen(true),
      cerrar: () => setOpen(false),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      otrasApartadas,
      MAX_POR_LINEA,
    };
  }, [items, open, carritoId, agregar, cambiarCantidad, quitar, vaciar, otrasApartadas]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
