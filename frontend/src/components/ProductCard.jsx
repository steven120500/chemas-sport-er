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
      // 🔥 TRUCO: Degradado lineal oscuro para dar relieve y destacar del fondo principal 🔥
      style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #0a0a0a 100%)' }}
      className={`group/card relative w-full rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-gray-800 hover:border-yellow-500 p-0 transition-all duration-300 cursor-pointer flex flex-col justify-between font-sans shadow-lg hover:shadow-2xl hover:shadow-yellow-500/30 overflow-hidden
        ${isAdmin && product.hidden ? "opacity-60 grayscale" : ""}
      `}
    >
      {/* 🔥 TELARAÑA EN LA ESQUINA DE LA TARJETA MÁS GRANDE 🔥 */}
      <img 
        src="/Araña.png" 
        alt="Telaraña decorativa" 
        className="absolute top-0 left-0 w-40 sm:w-60 opacity-[0.15] invert pointer-events-none z-0 transition-transform duration-700 group-hover/card:scale-105 origin-top-left" 
      />

      {isNuevo && !isTotalAgotado && (
        <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-40 w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center -rotate-12 shine-sutil pointer-events-none transition-all">
          <svg className="w-full h-full text-yellow-500" viewBox="0 0 100 100" fill="currentColor">
            <polygon points="50,0 58,15 74,8 77,24 94,22 91,38 100,48 91,59 95,76 78,77 74,93 58,85 50,100 42,85 26,93 22,77 5,76 9,59 0,48 9,38 6,22 23,24 26,8 42,15" />
          </svg>
          <span className="absolute text-black font-black text-xs sm:text-base tracking-tighter uppercase select-none">
            NEW
          </span>
        </div>
      )}

      <style>
        {`
          @keyframes minimalShine {
            0%, 100% { filter: drop-shadow(0 0 4px rgba(234,179,8,0.4)); }
            50% { filter: drop-shadow(0 0 10px rgba(234,179,8,0.9)); }
          }
          @keyframes platinumGlow {
            0%, 100% { filter: drop-shadow(0 0 3px rgba(234,179,8,0.3)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 8px rgba(234,179,8,0.8)); transform: scale(1.02); }
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
            0%, 45% { opacity: 0.4; width: 6px; background-color: #52525b; }
            55%, 100% { opacity: 1; width: 14px; background-color: #eab308; }
          }
          @keyframes dot2Sync {
            0%, 45% { opacity: 1; width: 14px; background-color: #eab308; }
            55%, 100% { opacity: 0.4; width: 6px; background-color: #52525b; }
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
        `}
      </style>

      <div className="relative grid grid-cols-12 w-full items-stretch min-h-[260px] sm:min-h-[380px]">
        
        {/* --- COLUMNA IZQUIERDA: INFORMACIÓN --- */}
        <div className="col-span-6 flex flex-col justify-between p-3.5 sm:p-6 pr-2 sm:pr-5 z-10">
          
          <div className="flex flex-col gap-1.5 sm:gap-2 items-start w-full relative z-10">
            {product.type && (
              <span className="shine-desktop-tipo bg-yellow-500 text-black text-[9px] sm:text-[11px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-sm">
                {product.type}
              </span>
            )}

            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {product.isPopular === true && (
                <>
                  <span className="sm:hidden shine-sutil bg-yellow-600 text-black p-1.5 rounded-full flex items-center justify-center">
                    <FaStar size={9} />
                  </span>
                  <span className="hidden sm:inline-flex shine-sutil bg-yellow-600 text-black text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    POPULAR
                  </span>
                </>
              )}
              {hasDiscount && !isTotalAgotado && (
                <>
                  <span className="sm:hidden shine-sutil bg-purple-700 text-white p-1.5 rounded-full flex items-center justify-center">
                    <FaTag size={9} />
                  </span>
                  <span className="hidden sm:inline-flex shine-sutil bg-purple-700 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    OFERTA
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col my-auto py-1.5 sm:py-2 relative z-10">
            <h3 className="text-[11px] sm:text-lg font-extrabold text-gray-100 group-hover/card:text-yellow-400 transition-colors duration-300 uppercase tracking-tight leading-snug line-clamp-3">
              {product.name}
            </h3>

            <div className="w-6 sm:w-10 border-t-2 border-yellow-600/50 my-2 sm:my-4"></div>

            <div className="flex flex-col">
              {hasDiscount ? (
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-sm text-gray-500 line-through font-bold">
                    ₡{Number(product.price).toLocaleString("de-DE")}
                  </span>
                  <span className="text-sm sm:text-2xl font-black text-yellow-500 tracking-tight drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]">
                    ₡{Number(product.discountPrice).toLocaleString("de-DE")}
                  </span>
                </div>
              ) : (
                <span className="text-sm sm:text-2xl font-black text-yellow-500 tracking-tight drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]">
                  ₡{Number(product.price).toLocaleString("de-DE")}
                </span>
              )}
            </div>

           {product.isTemporada2627 === true && (
              <div className="mt-3 sm:mt-6 transform -rotate-12 select-none pointer-events-none transition-transform duration-300 group-hover/card:rotate-0 self-start">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 sm:border-[3px] border-dashed border-yellow-500/50 bg-yellow-500/10 flex items-center justify-center relative transition-transform duration-700 group-hover/card:rotate-180">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-yellow-600/50 flex flex-col items-center justify-center text-center p-1 bg-black/50 backdrop-blur-sm">
                    <span className="text-xs sm:text-[11px] font-black tracking-widest text-yellow-500 uppercase leading-none">TEMP</span>
                    <div className="w-10 sm:w-18 border-t border-yellow-500/50 my-1.5 sm:my-1.5 mx-auto"></div>
                    <span className="text-xs sm:text-[15px] font-black text-yellow-500 tracking-tighter leading-none">26-27</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-2 flex items-end h-6 sm:h-8 relative z-10">
            {(!isTotalAgotado && secondaryImg) && (
              <div className="flex justify-start items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                <div className="h-1.5 rounded-full dot-1-animada w-[14px] bg-yellow-500"></div>
                <div className="h-1.5 rounded-full dot-2-animada w-[6px] bg-gray-600 opacity-40"></div>
              </div>
            )}
          </div>

        </div>

        {/* --- COLUMNA DERECHA: IMÁGENES --- */}
        <div className="col-span-6 relative w-full h-full z-10">
          {/* 🔥 Fondo de la imagen oscurecido para integrar mejor con el degradado de la tarjeta 🔥 */}
          <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: '#0f0f0f' }}>
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
                      isTotalAgotado ? "grayscale-[90%] opacity-40 blur-[1px]" : ""
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
                <div className="border-2 border-red-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.6)] transform -rotate-6 backdrop-blur-sm" style={{ backgroundColor: '#000' }}>
                  <span className="text-xs sm:text-base font-black uppercase tracking-widest text-center block text-red-500 drop-shadow">
                    AGOTADO
                  </span>
                </div>
              </div>
            )}

            {isAdmin && product.hidden && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-40 flex items-center justify-center pointer-events-none p-2 rounded-r-[14px] sm:rounded-r-[20px]">
                <div className="text-yellow-500 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transform -rotate-3 border border-yellow-500/50" style={{ backgroundColor: '#111' }}>
                  <span className="text-xs font-black uppercase tracking-widest text-center shadow-sm">
                    OCULTO
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {user?.isSuperUser && (
        <div className="px-3 sm:px-6 pb-3 pt-2 border-t border-dashed border-gray-800 text-[11px] sm:text-xs text-left w-full font-sans relative z-10" style={{ backgroundColor: 'rgba(5, 5, 5, 0.8)' }}>
          
          {(tiendaAgotadas.length > 0 || tiendaQueda1.length > 0) && (
            <>
              <p className="font-bold mt-1 text-gray-300">Tienda</p>
              {tiendaAgotadas.length > 0 && <p className="text-red-500 font-semibold">Agotado: {tiendaAgotadas.join(" ")}</p>}
              {tiendaQueda1.length > 0 && <p className="text-green-500 font-semibold">Queda 1: {tiendaQueda1.join(" ")}</p>}
            </>
          )}

          {(bodega1Agotadas.length > 0 || bodega1Queda1.length > 0) && (
            <>
              <p className="font-bold mt-2 text-gray-300">Bodega 1</p>
              {bodega1Agotadas.length > 0 && <p className="text-red-500 font-semibold">Agotado: {bodega1Agotadas.join(" ")}</p>}
              {bodega1Queda1.length > 0 && <p className="text-green-500 font-semibold">Queda 1: {bodega1Queda1.join(" ")}</p>}
            </>
          )}

          {(bodega2Agotadas.length > 0 || bodega2Queda1.length > 0) && (
            <>
              <p className="font-bold mt-2 text-gray-300">Bodega 2</p>
              {bodega2Agotadas.length > 0 && <p className="text-red-500 font-semibold">Agotado: {bodega2Agotadas.join(" ")}</p>}
              {bodega2Queda1.length > 0 && <p className="text-green-500 font-semibold">Queda 1: {bodega2Queda1.join(" ")}</p>}
            </>
          )}

          {traspasosUrgentes.length > 0 && (
            <div className="mt-2 border-l-4 border-red-700 text-red-400 p-2 rounded" style={{ backgroundColor: 'rgba(69, 10, 10, 0.5)' }}>
              <p className="font-bold text-red-500 mb-0.5">🚨 Traspasos a Tienda urgentes:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {traspasosUrgentes.map((t, i) => (
                  <li key={i}>Talla <b>{t.talla}</b> (B1: {t.bodega1}, B2: {t.bodega2})</li>
                ))}
              </ul>
            </div>
          )}

          {traspasosSugeridos.length > 0 && (
            <div className="mt-2 border-l-4 border-yellow-700 text-yellow-400 p-2 rounded" style={{ backgroundColor: 'rgba(66, 32, 6, 0.5)' }}>
              <p className="font-bold text-yellow-500 mb-0.5">📦 Traspasos a Tienda sugeridos:</p>
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