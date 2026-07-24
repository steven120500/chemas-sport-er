import { motion } from "framer-motion";
import { FaTag, FaStar, FaBan } from "react-icons/fa";

const cldUrl = (url, w, h) => {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(
    /\/upload\/(?!.*(f_auto|q_auto|w_|h_))/,
    `/upload/f_auto,q_auto:eco,c_fill,g_auto,e_sharpen:60,w_${w},h_${h}/`
  );
};

const ADULT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const KID_SIZES = ["16", "18", "20", "22", "24", "26", "28"];
const BALL_SIZES = ["3", "4", "5"];

export default function ProductCard({ product, onClick, user, index = 0 }) {
  // 🔥 ESCUDO ANTI-PANTALLA BLANCA 🔥
  if (!product) return null;

  // 🔍 Extracción robusta de la imagen principal y secundaria adaptada al esquema de la BD
  const primaryImg = product.imageSrc;
  const secondaryImg = 
    product.secondaryImage || 
    product.imageSrc2 || 
    product.secondImage || 
    product.foto2 || 
    product.img2 || 
    (Array.isArray(product.images) && product.images[1] && (typeof product.images[1] === 'string' ? product.images[1] : product.images[1].url)) || 
    null;

  const isAdmin = user?.isSuperUser || user?.roles?.includes("edit");

  const isNino = product.type === "Niño";
  const isBalon = product.type === "Balón" || product.type === "Balones";
  
  const sizesToCheck = isBalon ? BALL_SIZES : isNino ? KID_SIZES : ADULT_SIZES;

  const stockAgotadas = [];
  const stockQueda1 = [];
  const bodegaAgotadas = [];
  const bodegaQueda1 = [];
  const traspasosUrgentes = [];
  const traspasosSugeridos = [];

  let totalInventory = 0;

  for (const size of sizesToCheck) {
    const stockQty = Number(product.stock?.[size] ?? 0);
    const bodeQty = Number(product.bodega?.[size] ?? 0);

    totalInventory += (stockQty + bodeQty);

    if (user?.isSuperUser) {
      if (stockQty === 0) stockAgotadas.push(size);
      if (stockQty === 1) stockQueda1.push(size);
      if (bodeQty === 0) bodegaAgotadas.push(size);
      if (bodeQty === 1) bodegaQueda1.push(size);

      if (stockQty === 0 && bodeQty > 0) {
        traspasosUrgentes.push({ talla: size, stock: stockQty, bodega: bodeQty });
      } else if (stockQty === 1 && bodeQty > 0) {
        traspasosSugeridos.push({ talla: size, stock: stockQty, bodega: bodeQty });
      }
    }
  }

  const isTotalAgotado = totalInventory === 0;

  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice !== null &&
    Number(product.discountPrice) > 0;

  const isNuevo = product.createdAt 
    ? (new Date() - new Date(product.createdAt)) <= (5 * 24 * 60 * 60 * 1000) 
    : false;

  return (
    <motion.div
      // ⭐ ANIMACIÓN DE APARICIÓN AL INICIO ⭐
      initial={{ opacity: 0, y: 25, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.35), ease: "easeOut" }}
      
      // ⭐ ANIMACIONES DE INTERACCIÓN MODERNAS ⭐
      whileHover={{ scale: 1.03, y: -5, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(product)}
      className={`group/card relative w-full bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-black p-0 transition-shadow duration-300 cursor-pointer overflow-hidden flex flex-col justify-between font-sans shadow-sm hover:shadow-2xl
        ${isAdmin && product.hidden ? "opacity-60 grayscale" : ""}
      `}
    >
      {/* ⭐ ESTILOS CSS PARA BRILLOS Y ANIMACIONES ⭐ */}
      <style>
        {`
          @keyframes minimalShine {
            0%, 100% { filter: drop-shadow(0 0 2px rgba(0,0,0,0.3)); }
            50% { filter: drop-shadow(0 0 6px rgba(0,0,0,0.6)); }
          }
          @keyframes platinumGlow {
            0%, 100% { filter: drop-shadow(0 0 2px rgba(156, 163, 175, 0.3)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 8px rgba(209, 213, 219, 0.9)); transform: scale(1.02); }
          }
          .shine-sutil { animation: minimalShine 2.5s infinite ease-in-out; }
          @media (min-width: 768px) {
            .shine-desktop-tipo { animation: platinumGlow 2.2s infinite ease-in-out; display: inline-block; }
          }
        `}
      </style>

      {/* =========================================================================
          ⭐ CUERPO DEL CARD: GRILLA 6 vs 6 RESPONSIVA ⭐
          ========================================================================= */}
      <div className="relative grid grid-cols-12 w-full items-stretch min-h-[260px] sm:min-h-[380px]">
        
        {/* --- COLUMNA IZQUIERDA: INFORMACIÓN Y ETIQUETAS --- */}
        <div className="col-span-6 flex flex-col justify-between p-3.5 sm:p-6 pr-2 sm:pr-5 z-10">
          
          {/* ⭐ BLOQUE SUPERIOR IZQUIERDO: TIPO Y ETIQUETAS ⭐ */}
          <div className="flex flex-col gap-1.5 sm:gap-2 items-start w-full">
            
            {/* 🔸 Categoría / Tipo */}
            {product.type && (
              <span className="shine-desktop-tipo bg-gray-600 text-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-sm">
                {product.type}
              </span>
            )}

            {/* 🔹 ETIQUETAS */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              
              {/* ⭐ Popular */}
              {product.isPopular === true && (
                <>
                  <span className="sm:hidden shine-sutil bg-yellow-600 text-white p-1.5 rounded-full shadow-sm flex items-center justify-center" title="Popular">
                    <FaStar size={9} />
                  </span>
                  <span className="hidden sm:inline-flex shine-sutil bg-yellow-600 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm" title="Producto Popular">
                    POPULAR
                  </span>
                </>
              )}

              {/* 🟩 Oferta */}
              {hasDiscount && !isTotalAgotado && (
                <>
                  <span className="sm:hidden shine-sutil bg-green-600 text-white p-1.5 rounded-full shadow-sm flex items-center justify-center" title="Oferta">
                    <FaTag size={9} />
                  </span>
                  <span className="hidden sm:inline-flex shine-sutil bg-green-600 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                    OFERTA
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ⭐ BLOQUE CENTRAL IZQUIERDO: TÍTULO Y PRECIO ⭐ */}
          <div className="flex flex-col my-auto py-1.5 sm:py-2">
            
            <h3 className="text-[11px] sm:text-lg font-extrabold text-black uppercase tracking-tight leading-snug line-clamp-3">
              {product.name}
            </h3>

            <div className="w-6 sm:w-10 border-t-2 border-black my-2 sm:my-4"></div>

            <div className="flex flex-col">
              {hasDiscount ? (
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-sm text-gray-400 line-through font-bold">
                    ₡{Number(product.price).toLocaleString("de-DE")}
                  </span>
                  <span className="text-sm sm:text-2xl font-black text-green-600 tracking-tight">
                    ₡{Number(product.discountPrice).toLocaleString("de-DE")}
                  </span>
                </div>
              ) : (
                <span className="text-sm sm:text-2xl font-black text-black tracking-tight">
                  ₡{Number(product.price).toLocaleString("de-DE")}
                </span>
              )}
            </div>
          </div>

          <div className="h-1"></div>
        </div>

        {/* --- COLUMNA DERECHA: IMAGEN (Hover solo si NO está agotado) --- */}
        <div className="col-span-6 relative w-full h-full">
          
          {/* ⭐ ETIQUETA "NEW" ⭐ */}
          {isNuevo && !isTotalAgotado && (
            <div className="absolute top-1/2 -left-4 sm:-left-7 -translate-y-1/2 z-30 w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center -rotate-12 shine-sutil pointer-events-none">
              <svg className="w-full h-full text-black drop-shadow-md" viewBox="0 0 100 100" fill="currentColor">
                <polygon points="50,0 58,15 74,8 77,24 94,22 91,38 100,48 91,59 95,76 78,77 74,93 58,85 50,100 42,85 26,93 22,77 5,76 9,59 0,48 9,38 6,22 23,24 26,8 42,15" />
              </svg>
              <span className="absolute text-white font-black text-[9px] sm:text-xs tracking-tighter uppercase select-none">
                NEW
              </span>
            </div>
          )}

          {/* Contenedor de la Imagen */}
          <div className="relative w-full h-full bg-[#f4f4f4] overflow-hidden rounded-r-[16px] sm:rounded-r-[24px]">
            {(() => {
              const screenWidth = window.innerWidth;
              let H = 1000;
              if (screenWidth >= 1024) H = 700;
              else if (screenWidth >= 768) H = 1000;

              const pImg = cldUrl(primaryImg, 640, H) || primaryImg;
              // Si está agotado, ignoramos la secundaria para que no haga nada al pasar el mouse
              const sImg = !isTotalAgotado && secondaryImg ? (cldUrl(secondaryImg, 640, H) || secondaryImg) : null;

              return (
                <>
                  {/* 🖼️ Imagen Principal */}
                  <img
                    src={pImg}
                    alt={product.imageAlt || product.name}
                    className={`w-full h-full object-cover object-center transition-transform duration-700 ease-out ${
                      !isTotalAgotado ? "group-hover/card:scale-110" : ""
                    } ${
                      isTotalAgotado ? "grayscale-[90%] opacity-40 blur-[1px]" : ""
                    } ${sImg ? "group-hover/card:opacity-0 transition-opacity duration-300" : ""}`}
                    loading="lazy"
                    decoding="async"
                  />

                  {/* 🖼️ Imagen Secundaria (Solo hace hover si NO está agotado y existe) */}
                  {sImg && (
                    <img
                      src={sImg}
                      alt={`${product.name} secundaria`}
                      className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-500 ease-out opacity-0 group-hover/card:opacity-100 group-hover/card:scale-110`}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </>
              );
            })()}

            {/* 🛑 SELLO DE AGOTADO EN EL MEDIO DE LA TARJETA (MÓVIL Y PC) */}
            {isTotalAgotado && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-2 pointer-events-none">
                <div className="bg-black border-2 border-white text-white px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-2xl transform -rotate-6 backdrop-blur-md">
                  <span className="text-xs sm:text-base font-black uppercase tracking-widest text-center block text-gray-500 drop-shadow">
                    AGOTADO
                  </span>
                </div>
              </div>
            )}

            {/* 🟫 OVERLAY SI ESTÁ OCULTO */}
            {isAdmin && product.hidden && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-1">
                <span className="text-white text-[9px] font-bold text-center uppercase tracking-wider">
                  Oculto
                </span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* =========================================================================
          ⭐ PANEL DE LOGÍSTICA PARA SUPERUSUARIOS ⭐
          ========================================================================= */}
      {user?.isSuperUser && (
        <div className="px-3 sm:px-6 pb-3 pt-2 border-t border-dashed border-gray-300 text-[11px] sm:text-xs text-left w-full font-sans">
          {(stockAgotadas.length > 0 || stockQueda1.length > 0) && (
            <>
              <p className="font-bold mt-1 text-black">Tienda #1</p>
              {stockAgotadas.length > 0 && (
                <p className="text-red-600 font-semibold">Agotado: {stockAgotadas.join(" ")}</p>
              )}
              {stockQueda1.length > 0 && (
                <p className="text-green-600 font-semibold">Queda 1: {stockQueda1.join(" ")}</p>
              )}
            </>
          )}

          {(bodegaAgotadas.length > 0 || bodegaQueda1.length > 0) && (
            <>
              <p className="font-bold mt-2 text-black">Tienda #2</p>
              {bodegaAgotadas.length > 0 && (
                <p className="text-red-600 font-semibold">Agotado: {bodegaAgotadas.join(" ")}</p>
              )}
              {bodegaQueda1.length > 0 && (
                <p className="text-green-600 font-semibold">Queda 1: {bodegaQueda1.join(" ")}</p>
              )}
            </>
          )}

          {traspasosUrgentes.length > 0 && (
            <div className="mt-2 bg-red-50 border-l-4 border-red-500 text-red-800 p-2 rounded">
              <p className="font-bold text-red-700 mb-0.5">🚨 Traspasos urgentes:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {traspasosUrgentes.map((t, i) => (
                  <li key={i}>
                    Talla <b>{t.talla}</b> ({t.stock} en T1, {t.bodega} en T2)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {traspasosSugeridos.length > 0 && (
            <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-2 rounded">
              <p className="font-bold text-yellow-700 mb-0.5">📦 Traspasos sugeridos:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {traspasosSugeridos.map((t, i) => (
                  <li key={i}>
                    Talla <b>{t.talla}</b> ({t.stock} en T1, {t.bodega} en T2)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

    </motion.div>
  );
}