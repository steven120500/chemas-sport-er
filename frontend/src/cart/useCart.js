import { createContext, useContext, useEffect, useState } from "react";

// 🛒 Contexto del carrito (el provider está en CartContext.jsx)
export const CartContext = createContext(null);

// 📡 App.jsx reenvía aquí el evento del socket 'apartadasActualizadas' → { productId, apartadas: { talla: n } }
export const EVENTO_APARTADAS = "chemasport:apartadas";

// ⏳ Segundos que le quedan a un apartado (se actualiza cada segundo solo en el componente que lo usa)
export function useCuentaAtras(venceAt) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!venceAt) return;
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [venceAt]);
  return venceAt ? Math.max(0, Math.ceil((venceAt - ahora) / 1000)) : null;
}

export const mmss = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

// 💰 Formato de colones usado en toda la tienda
export const colones = (n) => `₡${Number(n || 0).toLocaleString("de-DE")}`;

// 💸 Miniatura chica de Cloudinary (nunca la URL original)
export const cldThumb = (url) => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) return url;
  return url.replace(/\/upload\/(?!.*(f_auto|q_auto|w_|h_))/, "/upload/f_auto,q_auto:eco,c_fill,g_auto,w_160,h_184/");
};

// 📦 Stock total de una talla sumando las 3 ubicaciones
export const stockDe = (p, talla) =>
  ["tienda", "stock", "bodega"].reduce((s, k) => s + (parseInt(p?.[k]?.[talla] ?? 0, 10) || 0), 0);

export const textoDorsal = (d) => (d ? `${d.name ? String(d.name).toUpperCase() : ""} #${d.number || ""}`.trim() : "");

// 🔄 Cruza las líneas del carrito con el catálogo en vivo: stock disponible, agotado, excede
// otrasApartadas(productId, talla): lo que tienen apartado otros carritos (no se puede contar como disponible)
export const lineasConStock = (items, products, otrasApartadas = () => 0) => {
  const porId = new Map((products || []).map((p) => [String(p._id || p.id), p]));
  return items.map((l) => {
    const p = porId.get(String(l.productId));
    const disponible = p ? Math.max(0, stockDe(p, l.talla) - otrasApartadas(l.productId, l.talla)) : null; // null = aún no carga el catálogo
    return {
      ...l,
      disponible,
      agotado: disponible === 0,
      excede: disponible !== null && disponible > 0 && l.cantidad > disponible,
    };
  });
};
