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
  if (!product) return null;

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
    const isLlavero = product.type === "Llaveros";
    
    const sizesToCheck = isLlavero 
      ? ["U"] 
      : (isBalon ? BALL_SIZES : isNino ? KID_SIZES : ADULT_SIZES);

  const tiendaAgotadas = [];
  const tiendaQueda1 = [];
  const bodega1Agotadas = [];
  const bodega1Queda1 = [];
  const bodega2Agotadas = [];
  const bodega2Queda1 = [];
  const traspasosUrgentes = [];
  const traspasosSugeridos = [];

  let totalInventory = 0;

  for (const size of sizesToCheck) {
    const tiendaQty = Number(product.tienda?.[size] ?? 0);
    const stockQty = Number(product.stock?.[size] ?? 0);
    const bodeQty = Number(product.bodega?.[size] ?? 0);

    totalInventory += (tiendaQty + stockQty + bodeQty);

    if (user?.isSuperUser) {
      if (tiendaQty === 0) tiendaAgotadas.push(size);
      if (tiendaQty === 1) tiendaQueda1.push(size);
      
      if (stockQty === 0) bodega1Agotadas.push(size);
      if (stockQty === 1) bodega1Queda1.push(size);
      
      if (bodeQty === 0) bodega2Agotadas.push(size);
      if (bodeQty === 1) bodega2Queda1.push(size);

      if (tiendaQty === 0 && (stockQty > 0 || bodeQty > 0)) {
        traspasosUrgentes.push({ talla: size, tienda: tiendaQty, bodega1: stockQty, bodega2: bodeQty });
      } else if (tiendaQty === 1 && (stockQty > 0 || bodeQty > 0)) {
        traspasosSugeridos.push({ talla: size, tienda: tiendaQty, bodega1: stockQty, bodega2: bodeQty });
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
      initial={{ opacity: 0, y: 25, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.35), ease: "easeOut" }}
      whileHover={{ scale: 1.03, y: -5, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(product)}
      className={`group/card relative w-full p-0 transition-all duration-300 cursor-pointer flex flex-col font-sans shadow-sm hover:shadow-xl rounded-2xl sm:rounded-[24px]
        ${isAdmin && product.hidden ? "opacity-60 grayscale" : ""}
      `}
    >
      {/* Etiqueta de "NEW" en blanco y negro */}
      {isNuevo && !isTotalAgotado && (
        <div className="absolute -top-3 -right-3 sm:-top-5 sm:-right-5 z-40 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center -rotate-12 shine-sutil pointer-events-none transition-all">
          <svg className="w-full h-full text-black drop-shadow-md" viewBox="0 0 100 100" fill="currentColor">
            <polygon points="50,0 58,15 74,8 77,24 94,22 91,38 100,48 91,59 95,76 78,77 74,93 58,85 50,100 42,85 26,93 22,77 5,76 9,59 0,48 9,38 6,22 23,24 26,8 42,15" />
          </svg>
          <span className="absolute text-white font-black text-[11px] sm:text-sm tracking-widest uppercase select-none mt-0.5">
            NEW
          </span>
        </div>
      )}

      <style>
        {`
          @keyframes minimalShine {
            0%, 100% { filter: drop-shadow(0 0 4px rgba(0,0,0,0.1)); }
            50% { filter: drop-shadow(0 0 10px rgba(0,0,0,0.3)); }
          }
          @keyframes platinumGlow {
            0%, 100% { filter: drop-shadow(0 0 3px rgba(0,0,0,0.05)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 8px rgba(0,0,0,0.15)); transform: scale(1.02); }
          }
          .shine-sutil { animation: minimalShine 2.5s infinite ease-in-out; }
          @media (min-width: 768px) {
            .shine-desktop-tipo { animation: platinumGlow 2.2s infinite ease-in-out; display: inline-block; }
          }

          @keyframes swapContinuo {
            0%, 45% { opacity: 1; }
            55%, 100% { opacity: 0; }
          }
          
          @keyframes dot1Sync {
            0%, 45% { opacity: 0.3; width: 6px; background-color: #9ca3af; }
            55%, 100% { opacity: 1; width: 14px; background-color: #000000; }
          }
          @keyframes dot2Sync {
            0%, 45% { opacity: 1; width: 14px; background-color: #000000; }
            55%, 100% { opacity: 0.3; width: 6px; background-color: #9ca3af; }
          }

          .group\\/card:hover .img-secundaria-animada {
            animation: swapContinuo 1.5s infinite;
          }
          .group\\/card:hover .dot-1-animada {
            animation: dot1Sync 1.5s infinite;
          }
          .group\\/card:hover .dot-2-animada {
            animation: dot2Sync 1.5s infinite;
          }

          .linea-hover {
            position: relative;
            display: inline-block;
          }
          .linea-hover::after {
            content: '';
            position: absolute;
            width: 100%;
            transform: scaleX(0);
            height: 2px;
            bottom: -2px;
            left: 0;
            background-color: #000;
            transform-origin: bottom right;
            transition: transform 0.3s ease-out;
          }
          .group\\/card:hover .linea-hover::after {
            transform: scaleX(1);
            transform-origin: bottom left;
          }
        `}
      </style>

  {/* Contenedor interno con bordes y fondo blanco puro */}
  <div className="relative grid grid-cols-12 w-full items-stretch min-h-[260px] sm:min-h-[380px] bg-white overflow-visible rounded-[14px] sm:rounded-[24px] border-2 sm:border-4 border-gray-200 group-hover/card:border-black transition-colors duration-300">
        
        {/* 🎀 CINTA HORIZONTAL SUPERIOR (De lado a lado) */}
        <div className="absolute -top-3 left-0 right-0 z-48 h-8 pointer-events-none flex items-center justify-center overflow-visible">
          <div className="absolute w-full h-3.5 bg-gradient-to-r from-red-700 via-red-500 to-red-700 border-y border-amber-300 shadow-sm"></div>
        </div>

        {/* 🎀 CINTA VERTICAL AL MEDIO (En la división exacta) */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-40 w-3.5 pointer-events-none flex justify-center overflow-visible">
          <div className="w-full h-full bg-gradient-to-b from-red-700 via-red-500 to-red-700 border-x border-amber-300 shadow-sm"></div>
        </div>

        {/* 🎀 MOÑO UBICADO EN LA ESQUINA SUPERIOR IZQUIERDA */}
        <div className="absolute -top-8 -left-3 z-40 pointer-events-none flex items-center justify-center">
          <img 
            src="/mono.png" 
            alt="Moño Navideño" 
            className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-2xl"
            onError={(e) => {
              console.error("Error cargando /mono.jpg");
              e.target.style.display = 'none';
            }} 
          />
        </div>

        {/* --- COLUMNA IZQUIERDA: INFORMACIÓN --- */}
        <div className="col-span-6 flex flex-col justify-between p-3.5 sm:p-6 pr-2 sm:pr-5 z-10">
          
          <div className="flex flex-col gap-1.5 sm:gap-2 items-start w-full relative z-10 pt-2">
            {product.type && (
              <span className="shine-desktop-tipo bg-black text-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-sm">
                {product.type}
              </span>
            )}

            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {product.isPopular === true && (
                <>
                  <span className="sm:hidden bg-black text-white p-1.5 rounded-full flex items-center justify-center shadow-sm">
                    <FaStar size={9} />
                  </span>
                  <span className="hidden sm:inline-flex bg-yellow-500 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                    POPULAR
                  </span>
                </>
              )}
              {hasDiscount && !isTotalAgotado && (
                <>
                  <span className="sm:hidden bg-zinc-800 text-white p-1.5 rounded-full flex items-center justify-center shadow-sm">
                    <FaTag size={9} />
                  </span>
                  <span className="hidden sm:inline-flex bg-green-500 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                    OFERTA
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col my-auto py-1.5 sm:py-2 relative z-10">
            <h3 className="linea-hover text-[11px] sm:text-lg font-extrabold text-black uppercase tracking-tight leading-snug line-clamp-3 w-fit">
              {product.name}
            </h3>

            <div className="w-6 sm:w-10 border-t-2 border-gray-200 my-2 sm:my-4"></div>

            <div className="flex flex-col">
              {hasDiscount ? (
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-sm text-gray-400 line-through font-bold">
                    ₡{Number(product.price).toLocaleString("de-DE")}
                  </span>
                  <span className="text-sm sm:text-2xl font-black text-black tracking-tight">
                    ₡{Number(product.discountPrice).toLocaleString("de-DE")}
                  </span>
                </div>
              ) : (
                <span className="text-sm sm:text-2xl font-black text-black tracking-tight">
                  ₡{Number(product.price).toLocaleString("de-DE")}
                </span>
              )}
            </div>

           {product.isTemporada2627 === true && (
              <div className="mt-3 sm:mt-6 transform -rotate-12 select-none pointer-events-none transition-transform duration-300 group-hover/card:rotate-0 self-start">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 sm:border-[3px] border-dashed border-gray-300 bg-gray-50 flex items-center justify-center relative transition-transform duration-700 group-hover/card:rotate-180">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-gray-200 flex flex-col items-center justify-center text-center p-1 bg-white/95 backdrop-blur-sm shadow-sm">
                    <span className="text-xs sm:text-[11px] font-black tracking-widest text-black uppercase leading-none">TEMP</span>
                    <div className="w-10 sm:w-18 border-t border-gray-200 my-1.5 sm:my-1.5 mx-auto"></div>
                    <span className="text-xs sm:text-[15px] font-black text-black tracking-tighter leading-none">26-27</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-2 flex items-end h-6 sm:h-8 relative z-10">
            {(!isTotalAgotado && secondaryImg) && (
              <div className="flex justify-start items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                <div className="h-1.5 rounded-full dot-1-animada w-[14px] bg-black"></div>
                <div className="h-1.5 rounded-full dot-2-animada w-[6px] bg-gray-400 opacity-40"></div>
              </div>
            )}
          </div>

        </div>

        {/* --- COLUMNA DERECHA: IMÁGENES --- */}
        <div className="col-span-6 relative w-full h-full z-10">
          <div className="relative w-full h-full bg-gray-100">
            {(() => {
              const screenWidth = window.innerWidth;
              let H = 1000;
              if (screenWidth >= 1024) H = 700;
              else if (screenWidth >= 768) H = 1000;

              const pImg = cldUrl(primaryImg, 640, H) || primaryImg;
              const sImg = !isTotalAgotado && secondaryImg ? (cldUrl(secondaryImg, 640, H) || secondaryImg) : null;

              return (
                <>
                  <img
                    src={pImg}
                    alt={product.imageAlt || product.name}
                    className={`w-full h-full object-cover object-center transition-transform duration-700 ease-out z-10 ${
                      !isTotalAgotado ? "group-hover/card:scale-110" : ""
                    } ${
                      isTotalAgotado ? "grayscale opacity-50 blur-[1px]" : ""
                    }`}
                    loading="lazy"
                    decoding="async"
                  />

                  {sImg && (
                    <img
                      src={sImg}
                      alt={`${product.name} secundaria`}
                      className={`absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out opacity-0 z-20 img-secundaria-animada ${
                        !isTotalAgotado ? "group-hover/card:scale-110" : ""
                      }`}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </>
              );
            })()}

            {isTotalAgotado && (
              <div className="absolute inset-0 z-40 flex items-center justify-center p-2 pointer-events-none">
                <div className="border-2 border-black bg-white/95 text-black px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-lg transform -rotate-6 backdrop-blur-sm">
                  <span className="text-xs sm:text-base font-black uppercase tracking-widest text-center block">
                    AGOTADO
                  </span>
                </div>
              </div>
            )}

            {isAdmin && product.hidden && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-40 flex items-center justify-center pointer-events-none p-2">
                <div className="text-black bg-gray-100 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transform -rotate-3 border border-gray-300">
                  <span className="text-xs font-black uppercase tracking-widest text-center shadow-sm">
                    OCULTO
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- SECCIÓN ADMINISTRADOR (INVENTARIO Y TRASPASOS) --- */}
      {user?.isSuperUser && (
        <div className="px-3 sm:px-6 pb-3 pt-2 mt-[-4px] border-x-2 border-b-2 sm:border-x-4 sm:border-b-4 border-gray-200 group-hover/card:border-black transition-colors duration-300 border-t-0 border-dashed text-[11px] sm:text-xs text-left w-full font-sans relative z-0 bg-gray-50 rounded-b-[14px] sm:rounded-b-[24px]">
          
          {(tiendaAgotadas.length > 0 || tiendaQueda1.length > 0) && (
            <>
              <p className="font-bold mt-1 text-gray-700">Tienda</p>
              {tiendaAgotadas.length > 0 && <p className="text-red-600 font-semibold">Agotado: {tiendaAgotadas.join(" ")}</p>}
              {tiendaQueda1.length > 0 && <p className="text-green-600 font-semibold">Queda 1: {tiendaQueda1.join(" ")}</p>}
            </>
          )}

          {(bodega1Agotadas.length > 0 || bodega1Queda1.length > 0) && (
            <>
              <p className="font-bold mt-2 text-gray-700">Bodega 1</p>
              {bodega1Agotadas.length > 0 && <p className="text-red-600 font-semibold">Agotado: {bodega1Agotadas.join(" ")}</p>}
              {bodega1Queda1.length > 0 && <p className="text-green-600 font-semibold">Queda 1: {bodega1Queda1.join(" ")}</p>}
            </>
          )}

          {(bodega2Agotadas.length > 0 || bodega2Queda1.length > 0) && (
            <>
              <p className="font-bold mt-2 text-gray-700">Bodega 2</p>
              {bodega2Agotadas.length > 0 && <p className="text-red-600 font-semibold">Agotado: {bodega2Agotadas.join(" ")}</p>}
              {bodega2Queda1.length > 0 && <p className="text-green-600 font-semibold">Queda 1: {bodega2Queda1.join(" ")}</p>}
            </>
          )}

          {traspasosUrgentes.length > 0 && (
            <div className="mt-2 border-l-4 border-black bg-gray-100 text-black p-2 rounded">
              <p className="font-bold mb-0.5">🚨 Traspasos a Tienda urgentes:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {traspasosUrgentes.map((t, i) => (
                  <li key={i}>Talla <b>{t.talla}</b> (B1: {t.bodega1}, B2: {t.bodega2})</li>
                ))}
              </ul>
            </div>
          )}

          {traspasosSugeridos.length > 0 && (
            <div className="mt-2 border-l-4 border-gray-400 bg-gray-50 text-gray-800 p-2 rounded">
              <p className="font-bold mb-0.5">📦 Traspasos a Tienda sugeridos:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {traspasosSugeridos.map((t, i) => (
                  <li key={i}>Talla <b>{t.talla}</b> (B1: {t.bodega1}, B2: {t.bodega2})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}