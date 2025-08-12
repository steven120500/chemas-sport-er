import { motion } from 'framer-motion';

export default function ProductCard({ product, onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="relative bg-white  rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden w-full"
      onClick={() => onClick(product)}
    >
      {/* Etiqueta del tipo de producto */}
      {product.type && (
        <div className="absolute top-2 left-2 z-10 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-black text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
            {product.type}
          </div>
        </div>
      )}

      {/* Imagen del producto con altura fija */}
      <div className="w-full  h-[300px] bg-gray-100">
        <img
          src={product.imageSrc}
          alt={product.imageAlt || product.name}
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Nombre y precio */}
      <div className="p-4 text-center flex flex-col items-center justify-between h-[100px]">
        <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xl font-bold text-gray-800">
          ₡{product.price?.toLocaleString('de-DE') || product.price}
        </p>
      </div>
    </motion.div>
  );
}