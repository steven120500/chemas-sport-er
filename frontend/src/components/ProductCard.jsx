  // src/components/ProductCard.jsx
import { motion } from "framer-motion";

// 🔽 helper para armar URLs de Cloudinary optimizadas
const cldUrl = (url, w, h) => {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;

  return url.replace(
    /\/upload\/(?!.*(f_auto|q_auto|w_|h_))/,
    `/upload/f_auto,q_auto:eco,c_fill,g_auto,e_sharpen:60,w_${w},h_${h}/`
  );
};

export default function ProductCard({ product, onClick, user }) {
  // 🔹 Validar permisos
  const canEdit = user?.isSuperUser || user?.roles?.includes("edit");

  // 🔹 Detectar tallas con poco stock (1 o 2)
  const lowStockSizes = Object.entries(product.stock || {}).filter(
    ([, qty]) => Number(qty) > 0 && Number(qty) <= 2
  );

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="relative bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden w-full"
      onClick={() => onClick(product)}
    >
      {/* Etiqueta del tipo de producto */}
      {product.type && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-black text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
            {product.type}
          </div>
        </div>
      )}

      {/* Imagen del producto */}
      <div className="w-full h-[300px] bg-gray-100">
        {(() => {
          const H = 700;
          const img320 = cldUrl(product.imageSrc, 320, H);
          const img640 = cldUrl(product.imageSrc, 640, H);
          const img960 = cldUrl(product.imageSrc, 960, H);

          return (
            <img
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

      {/* Nombre y precio */}
      <div className="p-4 text-center flex flex-col items-center justify-between h-[120px]">
        <h3 className="text-sm sm:text-base md:text-lg font-extrabold font-sans text-gray-900 leading-tight line-clamp-2">
          {product.name}
        </h3>
        <p className="mt-2 text-base sm:text-lg md:text-xl font-semibold tracking-tight text-black">
          ₡{product.price?.toLocaleString("de-DE") || product.price}
        </p>

        {/* 🔔 Warning de bajo stock (solo si tiene permisos) */}
        {canEdit && lowStockSizes.length > 0 && (
          <div className="mt-2 text-xs text-red-600 font-semibold">
            {lowStockSizes.map(([size, qty]) => (
              <div key={size}>
                ⚠️ Quedan {qty} en talla {size}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}