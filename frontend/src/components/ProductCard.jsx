import { motion } from 'framer-motion';

export default function ProductCard({ product, onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition cursor-pointer overflow-hidden"
      onClick={() => onClick(product)}
    >
      <div className="aspect-square w-full bg-gray-100">
        <img
          src={product.imageSrc}
          alt={product.imageAlt}
          className="w-full h-full object-cover object-center transition-opacity duration-300 hover:opacity-80"
        />
      </div>
      <div className="p-4 text-center">
        <h3 className="text-base font-semibold text-gray-800">{product.name}</h3>
        <p className="text-sm text-gray-600 mt-1">{product.price}</p>
        <span className="inline-block mt-1 text-xs px-2 py-1 rounded bg-black text-white">
          {product.type}
        </span>
      </div>
    </motion.div>
  );
}
