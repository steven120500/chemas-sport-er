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

export default function ProductCard({ product, onClick, user }) {
  const isNino = product.type === "Niño";
  const sizesToCheck = isNino ? KID_SIZES : ADULT_SIZES;

  let warnings = [];

  if (user?.isSuperUser) {
    const agotadas = [];
    const quedan1 = [];

    for (const size of sizesToCheck) {
      const n = Number(product.stock?.[size]) || 0;
      if (n === 0) {
        agotadas.push(size);
      } else if (n === 1) {
        quedan1.push(size);
      }
    }

    if (agotadas.length > 0) {
      warnings.push(
        `⚠️ Agotado en talla${agotadas.length > 1 ? "s" : ""} ${agotadas.join(", ")}`
      );
    }
    if (quedan1.length > 0) {
      warnings.push(
        `⚠️ Queda 1 en talla${quedan1.length > 1 ? "s" : ""} ${quedan1.join(", ")}`
      );
    }
  }

  const hasDiscount =
    product.discountPrice && Number(product.discountPrice) > 0;

  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.97 }}
      className="relative bg-yellow-600 rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden w-full"
      onClick={() => onClick(product)}
    >
      {/* 🔹 Tipo de producto */}
      {product.type && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-black text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
            {product.type}
          </div>
        </div>
      )}

      {/* 💰 Etiqueta de oferta */}
      {hasDiscount && (
        <span className="absolute bottom-44 bg-purple-600 text-white text-sm font-bold px-4 py-1 shadow z-10">
          Oferta
        </span>
      )}

      {/* 🕸️ Imagen principal + decoraciones */}
      <div className="relative w-full h-[300px] bg-gray-100 overflow-hidden">
        {/* 🕷️ Telaraña decorativa */}
        <img
          src={"/Araña.png"}
          alt="Telaraña decorativa"
          className="absolute top-2 w-28 sm:w-48 rotate-[12deg]  duration-300 hover:scale-110"
          style={{
            transform: "translate(-5px, -12px) rotate(-8deg)",
            objectFit: "contain",
          }}
        />

        {/* 🦇 Murciélago decorativo */}
        <img
          src={"/Mucielago.png"}
          alt="Murciélago decorativo"
          className="absolute -bottom-3 -right-12 w-28 sm:w-48 rotate-[12deg]  duration-300 hover:scale-110"
          style={{
            transform: "translate(-10px, -15px) rotate(6deg)",
            objectFit: "contain",
          }}
        />

        {/* 🖼️ Imagen del producto */}
        {(() => {
          const H = 800;
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

      {/* Información del producto */}
      <div className="p-4 text-center flex flex-col items-center justify-between">
        <h3 className="text-sm sm:text-base md:text-lg font-extrabold text-gray-900 line-clamp-2">
          {product.name}
        </h3>

        {/* 💰 Precio normal o con descuento */}
        {hasDiscount ? (
          <div className="mt-2 flex flex-col items-center">
            <p className="text-sm sm:text-base line-through text-gray-600">
              ₡{Number(product.price).toLocaleString("de-DE")}
            </p>
            <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-purple-600">
              ₡{Number(product.discountPrice).toLocaleString("de-DE")}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-base sm:text-lg md:text-xl font-semibold text-black">
            ₡{Number(product.price).toLocaleString("de-DE")}
          </p>
        )}

        {/* ⚠️ Avisos solo para superadmin */}
        {user?.isSuperUser && warnings.length > 0 && (
          <div className="mt-2 space-y-1 text-xs sm:text-sm text-red-600 font-semibold">
            {warnings.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
