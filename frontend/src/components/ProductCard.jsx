import { motion } from 'framer-motion';

export default function ProductCard({ product, onClick }) {
  return (
    <motion.div
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.98 }}
    className="relative bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden group w-full max-w-[300px] h-[420px] flex flex-col"
    onClick={() => onClick(product)}
    >
      {/* Etiqueta tipo flecha - visible solo sin hover */}
      <div className="absolute top-5 left-0 z-10 group-hover:opacity-0 transition-opacity duration-300">
        <div className="bg-black text-white text-sm font-semibold px-5 py-1 rounded-r-full shadow">
          {product.type}
        </div>
      </div>

      {/* Imagen cuadrada */}
      <div className="aspect-square w-full bg-gray-100">
      <img
    src={product.imageSrc}
    alt={product.imageAlt}
    className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Nombre y precio */}
      <div className="p-4 text-center flex-grow flex flex-col justify-between">
  <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2">
    {product.name}
  </h3>
  <p className="text-xl font-bold text-gray-800 mt-2">₡{product.price}</p>
</div>

    </motion.div>
  );
}
