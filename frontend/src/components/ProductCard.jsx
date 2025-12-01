// src/components/ProductCard.jsx
import { motion } from "framer-motion";


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


export default function ProductCard({ product, onClick, user }) {
  const isNino = product.type === "Niño";
  const isBalon = product.type === "Balón" || product.type === "Balones";


  const sizesToCheck = isBalon ? BALL_SIZES : isNino ? KID_SIZES : ADULT_SIZES;


  const stockAgotadas = [];
  const stockQueda1 = [];
  const bodegaAgotadas = [];
  const bodegaQueda1 = [];
  const traspasosUrgentes = [];
  const traspasosSugeridos = [];


  if (user?.isSuperUser) {
    for (const size of sizesToCheck) {
      const stockQty = Number(product.stock?.[size] ?? 0);
      const bodeQty = Number(product.bodega?.[size] ?? 0);


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


  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice !== null &&
    Number(product.discountPrice) > 0;


  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.97 }}
      className="relative bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden w-full"
      onClick={() => onClick(product)}
    >
      {/* 🔸 Tipo */}
      {product.type && (
        <div className="absolute top-2 left-2 z-10">
          <div className="text-white text-xs font-semibold px-3 py-1 rounded-full shadow bg-black">
            {product.type}
          </div>
        </div>
      )}


      {/* 🟩 Oferta */}
      {hasDiscount && (
        <span className="absolute etiqueta-oferta-verde bottom-44 -right-2 text-white font-bold shadow z-10 text-xs sm:text-xs md:text-sm px-2 py-1 md:px-3 md:py-2">
          Oferta
        </span>
      )}


      {/* 🟧 ⭐ POPULAR ⭐ */}
      {product.isPopular === true && (
        <span className="absolute etiqueta-popular-naranja top-2 right-2 z-10 text-white font-bold text-xs sm:text-sm px-2 py-1 rounded">
          Popular
        </span>
      )}


      {/* Imagen */}
      <div className="relative w-full h-[300px] bg-gray-100 overflow-hidden">
        {(() => {
          const screenWidth = window.innerWidth;
          let H = 1000;
          if (screenWidth >= 1024) H = 700;
          else if (screenWidth >= 768) H = 1000;


          const img320 = cldUrl(product.imageSrc, 320, H);
          const img640 = cldUrl(product.imageSrc, 640, H);
          const img960 = cldUrl(product.imageSrc, 960, H);


          return (
            <motion.img
              src={img640 || product.imageSrc}
              srcSet={
                img320 && img640 && img960
                  ? `${img320} 320w, ${img640} 640w, ${img960} 960w`
                  : undefined
              }
              sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              alt={product.imageAlt || product.name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
          );
        })()}
      </div>


      {/* Info */}
      <div className="p-4 text-center flex flex-col items-center justify-between">
        <h3 className="text-sm sm:text-base md:text-lg font-extrabold text-gray-900 line-clamp-2">
          {product.name}
        </h3>


        {/* Precio */}
        {hasDiscount ? (
          <div className="mt-2 flex flex-col items-center">
            <p className="text-sm sm:text-base line-through text-gray-700">
              ₡{Number(product.price).toLocaleString("de-DE")}
            </p>
            <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-green-700">
              ₡{Number(product.discountPrice).toLocaleString("de-DE")}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-base sm:text-lg md:text-xl font-semibold text-black">
            ₡{Number(product.price).toLocaleString("de-DE")}
          </p>
        )}


        {/* Avisos superadmin */}
        {user?.isSuperUser && (
          <div className="mt-3 text-xs sm:text-sm text-left w-full px-2">
            {(stockAgotadas.length > 0 || stockQueda1.length > 0) && (
              <>
                <p className="font-bold text-black">Tienda #1</p>
                {stockAgotadas.length > 0 && (
                  <p className="text-red-600">Agotado {stockAgotadas.join(" ")}</p>
                )}
                {stockQueda1.length > 0 && (
                  <p className="text-green-600">Queda 1 {stockQueda1.join(" ")}</p>
                )}
              </>
            )}


            {(bodegaAgotadas.length > 0 || bodegaQueda1.length > 0) && (
              <>
                <p className="font-bold text-black mt-2">Tienda #2</p>
                {bodegaAgotadas.length > 0 && (
                  <p className="text-red-600">Agotado {bodegaAgotadas.join(" ")}</p>
                )}
                {bodegaQueda1.length > 0 && (
                  <p className="text-green-600">Queda 1 {bodegaQueda1.join(" ")}</p>
                )}
              </>
            )}


            {traspasosUrgentes.length > 0 && (
              <div className="mt-3 bg-red-100 border-l-4 border-red-500 text-red-800 p-2 rounded">
                <p className="font-bold text-red-700 mb-1">🚨 Traspasos urgentes a Tienda 1:</p>
                <ul className="list-disc pl-5 text-red-800">
                  {traspasosUrgentes.map((t, i) => (
                    <li key={i}>
                      Talla {t.talla} ({t.stock} en T1, {t.bodega} en T2)
                    </li>
                  ))}
                </ul>
              </div>
            )}


            {traspasosSugeridos.length > 0 && (
              <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-2 rounded">
                <p className="font-bold text-yellow-700 mb-1">📦 Traspasos sugeridos:</p>
                <ul className="list-disc pl-5 text-yellow-800">
                  {traspasosSugeridos.map((t, i) => (
                    <li key={i}>
                      Talla {t.talla} ({t.stock} en T1, {t.bodega} en T2)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
