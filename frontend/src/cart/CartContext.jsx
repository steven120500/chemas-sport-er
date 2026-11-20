import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast as toastHOT } from "react-hot-toast";
import { CartContext, EVENTO_APARTADAS } from "./useCart";
import { API_BASE } from "../authFetch";

// 🛒 Carrito de compras del cliente (vive en el navegador, en localStorage).
// Cada línea = producto + talla + dorsal. La misma camiseta en otra talla o con otro dorsal es otra línea.
// ⚠️ El precio guardado es solo referencia: al pagar (Tilopay) el backend lo recalcula desde la BD.
//
// ⏳ APARTADO: el carrito por sí solo NO aparta nada (puede tener camisetas de hace días y no le resta a nadie).
// Al ENTRAR AL CHECKOUT se llama apartarCarrito() → POST /api/checkout/apartar: revisa que haya de todo
// (si falta algo devuelve cuáles) y aparta el carrito entero con un solo reloj: 10 min + 2 por camiseta extra (tope 30).
// Al vencer, las camisetas siguen en el carrito pero ya no están apartadas (hay que volver a revisar).
// Si algo se agotó mientras tanto, el carrito lo marca "Se agotó" con el stock en vivo (lineasConStock).

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

// 🛒→💳 Revisa y aparta todo el carrito (items vacío = soltar todo)
async function apartarTodoEnServidor(carritoId, items) {
  const grupos = new Map();
  for (const l of items) {
    const k = grupoDe(l.productId, l.talla);
    grupos.set(k, { productId: l.productId, talla: l.talla, cantidad: (grupos.get(k)?.cantidad || 0) + l.cantidad });
  }
  const r = await fetch(`${API_BASE}/api/checkout/apartar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carritoId, items: [...grupos.values()] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "No se pudo revisar el stock.");
    err.faltantes = Array.isArray(data.faltantes) ? data.faltantes : null;
    err.status = r.status;
    throw err;
  }
  return data;
}

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
        // Las camisetas sin apartado siguen en el carrito (solo dejan de estar apartadas)
        const vivas = new Map(reservas.map((r) => [grupoDe(String(r.productId), r.talla), aLocal(r.expiresAt, ahoraServidor)]));
        setItems((prev) => prev.map((l) => ({ ...l, venceAt: vivas.get(grupoDe(l.productId, l.talla)) || null })));
      } catch {
        /* sin conexión: se deja como está */
      }
    })();
    return () => { vivo = false; };
  }, [carritoId]);

  // ⏱️ Cada segundo mientras haya algo apartado: lo vencido deja de estar apartado (sigue en el carrito).
  // (El contador que se ve en pantalla usa useCuentaAtras, así no se repinta toda la app cada segundo)
  const hayApartadas = items.some((l) => l.venceAt);
  useEffect(() => {
    if (!hayApartadas) return;
    const t = setInterval(() => {
      const n = Date.now();
      const vencidas = itemsRef.current.filter((l) => l.venceAt && l.venceAt <= n);
      if (!vencidas.length) return;
      setItems((prev) => prev.map((l) => (l.venceAt && l.venceAt <= n ? { ...l, venceAt: null } : l)));
      toastHOT("⏳ Se acabó el tiempo de apartado. Tus camisetas siguen en el carrito, pero ya no están apartadas.", { duration: 7000, style: ESTILO_TOAST });
    }, 1000);
    return () => clearInterval(t);
  }, [hayApartadas]);

  // 🛍️ ¿Nos soltaron algo en el servidor? (la tienda vendió esa camiseta y ya no alcanzaba para este carrito)
  // Se compara lo apartado en el servidor con lo del carrito: si el servidor tiene MENOS y el reloj no había vencido → se vendió.
  const revisarVendidas = useCallback(async (productId) => {
    try {
      const r = await fetch(`${API_BASE}/api/checkout/reservas/${carritoId}`);
      if (!r.ok) return;
      const { reservas = [] } = await r.json();
      const enServidor = new Map(
        reservas.filter((x) => String(x.productId) === productId).map((x) => [x.talla, Number(x.cantidad) || 0])
      );
      const ahora = Date.now();
      const tallas = [...new Set(itemsRef.current.filter((l) => l.productId === productId && l.venceAt > ahora + 2000).map((l) => l.talla))];
      const recorte = new Map(); // talla → cuántas quedan permitidas
      for (const talla of tallas) {
        const mias = totalGrupo(itemsRef.current, productId, talla);
        const quedan = enServidor.get(talla) || 0;
        if (quedan < mias) recorte.set(talla, quedan);
      }
      if (!recorte.size) return;
      // Deja en cada talla solo lo que sigue apartado en el servidor
      const recortar = (lista) => {
        const restante = new Map(recorte);
        const vendidas = [];
        const nueva = lista.flatMap((l) => {
          if (l.productId !== productId || !restante.has(l.talla)) return [l];
          const cabe = restante.get(l.talla);
          const cant = Math.min(l.cantidad, cabe);
          restante.set(l.talla, cabe - cant);
          if (cant < l.cantidad) vendidas.push(`${l.name} (talla ${nombreTalla(l.talla)})`);
          return cant > 0 ? [{ ...l, cantidad: cant }] : [];
        });
        return { nueva, vendidas };
      };
      const { vendidas } = recortar(itemsRef.current);
      setItems((prev) => recortar(prev).nueva);
      if (vendidas.length) {
        toastHOT(`😕 ${[...new Set(vendidas)].join(", ")} se acaba de vender. La quitamos de tu carrito.`, { duration: 8000, style: ESTILO_TOAST });
      }
    } catch {
      /* sin conexión: se revisa en la próxima */
    }
  }, [carritoId]);

  // 📡 App reenvía el evento del socket ('apartadasActualizadas') como evento del navegador
  useEffect(() => {
    const on = (e) => {
      const { productId, apartadas } = e.detail || {};
      if (productId) setApartadasTodas((prev) => ({ ...prev, [String(productId)]: apartadas || {} }));
      if (productId && itemsRef.current.some((l) => l.productId === String(productId) && l.venceAt)) revisarVendidas(String(productId));
    };
    window.addEventListener(EVENTO_APARTADAS, on);
    return () => window.removeEventListener(EVENTO_APARTADAS, on);
  }, [revisarVendidas]);

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

  /** Agrega al carrito (no aparta: eso pasa al entrar al checkout). Devuelve true si se pudo. */
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
      setItems((prev) => {
        const existe = prev.find((l) => l.key === key);
        return existe
          ? prev.map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + suma, precio, precioAntes } : l))
          : [...prev, { key, productId, name, type, image, talla, dorsal, precio, precioAntes, cantidad: suma, venceAt: null }];
      });
      return true;
    },
    []
  );

  const cambiarCantidad = useCallback(
    async (key, cantidad) => {
      const actual = itemsRef.current;
      const linea = actual.find((l) => l.key === key);
      if (!linea) return;
      const nueva = Math.max(0, Math.min(MAX_POR_LINEA, cantidad));
      const total = totalGrupo(actual, linea.productId, linea.talla) - linea.cantidad + nueva;

      // ➕ Sumar no aparta (el checkout vuelve a revisar y apartar). ➖ Bajar suelta en el servidor si estaba apartada.
      setItems((prev) => (nueva <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, cantidad: nueva } : l))));
      if (nueva < linea.cantidad && linea.venceAt) apartarEnServidor(carritoId, linea.productId, linea.talla, total).catch(() => {});
    },
    [carritoId]
  );

  /**
   * 🛒→💳 Al entrar al checkout: revisa que haya de todo y aparta el carrito entero.
   * Devuelve { ok: true } | { ok: false, faltantes: [...] } (falta stock) | { ok: false, error } (sin conexión, etc.)
   */
  const apartarCarrito = useCallback(async () => {
    const actual = itemsRef.current;
    if (!actual.length) return { ok: true };
    try {
      const r = await apartarTodoEnServidor(carritoId, actual);
      const venceAt = r.expiresAt ? aLocal(r.expiresAt, r.ahora) : null;
      // Solo las líneas que se mandaron (si cambió el carrito mientras tanto, se vuelve a llamar)
      const mandadas = new Set(actual.map((l) => grupoDe(l.productId, l.talla)));
      setItems((prev) => prev.map((l) => (mandadas.has(grupoDe(l.productId, l.talla)) ? { ...l, venceAt } : l)));
      return { ok: true };
    } catch (err) {
      if (err.faltantes) {
        setItems((prev) => prev.map((l) => ({ ...l, venceAt: null })));
        return { ok: false, faltantes: err.faltantes, error: err.message };
      }
      return { ok: false, error: err.message };
    }
  }, [carritoId]);

  const quitar = useCallback((key) => cambiarCantidad(key, 0), [cambiarCantidad]);

  // Vacía y suelta todo (después de pagar el servidor ya las soltó: no pasa nada)
  const vaciar = useCallback(() => {
    setItems([]);
    apartarTodoEnServidor(carritoId, []).catch(() => {});
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
      apartarCarrito,
      cambiarCantidad,
      quitar,
      vaciar,
      otrasApartadas,
      MAX_POR_LINEA,
    };
  }, [items, open, carritoId, agregar, apartarCarrito, cambiarCantidad, quitar, vaciar, otrasApartadas]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
