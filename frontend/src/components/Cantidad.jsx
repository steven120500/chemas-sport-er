import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

const Cantidad = ({ products = [], isSuperUser = false }) => {
  const [open, setOpen] = useState(false);

  if (!isSuperUser || !products.length) return null;

  // 🔥 ACTUALIZADO: Agrupar por tipo y sumar las 3 ubicaciones (tienda + stock + bodega)
  const counts = products.reduce((acc, product) => {
    const type = product.type || "Sin tipo";
    const tiendaObj = product.tienda || {};
    const stockObj = product.stock || {};
    const bodegaObj = product.bodega || {};

    const totalTienda = Object.values(tiendaObj).reduce(
      (sum, qty) => sum + Number(qty || 0),
      0
    );
    const totalStock = Object.values(stockObj).reduce(
      (sum, qty) => sum + Number(qty || 0),
      0
    );
    const totalBodega = Object.values(bodegaObj).reduce(
      (sum, qty) => sum + Number(qty || 0),
      0
    );

    const totalForProduct = totalTienda + totalStock + totalBodega;

    acc[type] = (acc[type] || 0) + totalForProduct;
    return acc;
  }, {});

  // Calcular total general de todas las ubicaciones
  const totalAll = Object.values(counts).reduce(
    (sum, qty) => sum + Number(qty),
    0
  );

  return (
    <div className="w-full bg-black text-white py-2 px-4 text-center select-none">
      <div
        className="cursor-pointer flex items-center justify-center gap-2"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-lg tracking-wide">
          Ver Total
        </span>
        {open ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm sm:text-base">
          {Object.entries(counts).map(([type, qty]) => (
            <div key={type} className="flex gap-1 items-center">
              <span className="capitalize">{type}:</span>
              <span className="font-semibold">{qty.toLocaleString("de-DE")}</span>
            </div>
          ))}
          <div className="flex gap-1 items-center font-semibold border-t border-white pt-1 mt-1 ml-2 pl-2">
            <span>Total general:</span>
            <span>{totalAll.toLocaleString("de-DE")}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cantidad;