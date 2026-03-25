import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { FaTimes, FaChevronLeft, FaChevronRight, FaStore, FaWarehouse } from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const ACCEPTED_TYPES = ["image/png", "image/jpg", "image/jpeg", "image/heic"];

const MODAL_IMG_MAX_W = 800;
const THUMB_MAX_W = 240;

function transformCloudinary(url, maxW) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return url;
    const parts = u.pathname.split("/upload/");
    if (parts.length < 2) return url;
    const transforms = `f_auto,q_auto:eco,c_limit,w_${maxW},dpr_auto`;
    u.pathname = `${parts[0]}/upload/${transforms}/${parts[1]}`;
    return u.toString();
  } catch {
    return url;
  }
}

function isLikelyObjectId(v) {
  return typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);
}

export default function ProductModal({
  product,
  isOpen, 
  onClose,
  onUpdate,
  canEdit,
  canDelete,
  user,
}) {
  const modalRef = useRef(null);

  const [viewProduct, setViewProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(false);
  const [invMode, setInvMode] = useState("stock");

  const [editedStock, setEditedStock] = useState(product.stock || {});
  const [editedBodega, setEditedBodega] = useState(product.bodega || {});
  const [editedName, setEditedName] = useState(product?.name || "");
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(
    product?.discountPrice ?? 0
  );
  const [editedType, setEditedType] = useState(product?.type || "Player");
  const [loading, setLoading] = useState(false);

  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);
  const [editedIsMundial2026, setEditedIsMundial2026] = useState(product?.isMundial2026 || false);

  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images
        .map((i) => (typeof i === "string" ? i : i?.url))
        .filter(Boolean);
    }
    return [product?.imageSrc, product?.imageSrc2].filter(Boolean);
  }, [product]);

  const [localImages, setLocalImages] = useState(
    galleryFromProduct.map((src) => ({ src, isNew: false }))
  );
  const [idx, setIdx] = useState(0);
  const hasMany = localImages.length > 1;
  const currentSrc = localImages[idx]?.src || "";

  useEffect(() => {
    setViewProduct(product);
    setEditedName(product?.name || "");
    setEditedPrice(product?.price ?? 0);
    setEditedDiscountPrice(product?.discountPrice ?? 0);
    setEditedType(product?.type || "Player");
    setEditedStock({ ...(product?.stock || {}) });
    setEditedBodega({ ...(product?.bodega || {}) });

    setEditedHidden(product?.hidden || false);
    setEditedIsMundial2026(product?.isMundial2026 || false); 

    setLocalImages(
      product?.images?.length
        ? product.images.map((img) => ({
            src: typeof img === "string" ? img : img.url,
            isNew: false,
          }))
        : [
            ...(product?.imageSrc
              ? [{ src: product.imageSrc, isNew: false }]
              : []),
            ...(product?.imageSrc2
              ? [{ src: product.imageSrc2, isNew: false }]
              : []),
          ]
    );
    setIdx(0);
  }, [product]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleSave = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) {
      toast.error("No se encontró un ID válido del producto");
      return;
    }

    try {
      setLoading(true);
      const displayName = user?.username || user?.email || "ChemaSportER";

      const priceInt = Math.max(0, parseInt(editedPrice, 10) || 0);
      const discountInt = Math.max(
        0,
        parseInt(editedDiscountPrice, 10) || 0
      );
      const clean = (obj) =>
        Object.fromEntries(
          Object.entries(obj || {}).map(([k, v]) => [
            k,
            Math.max(0, parseInt(v, 10) || 0),
          ])
        );

      const payload = {
        name: (editedName || "").trim(),
        price: priceInt,
        discountPrice: discountInt,
        type: (editedType || "").trim(),
        stock: clean(editedStock),
        bodega: clean(editedBodega),
        images: localImages.map((i) => i?.src).filter(Boolean),
        imageSrc:
          typeof localImages[0]?.src === "string" ? localImages[0].src : null,
        imageSrc2:
          typeof localImages[1]?.src === "string" ? localImages[1].src : null,
        imageAlt: (editedName || "").trim(),
        hidden: editedHidden,
        isMundial2026: editedIsMundial2026, 
      };

      const res = await fetch(
        `${API_BASE}/api/products/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user": displayName,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(`Error al actualizar (${res.status})`);

      const updated = await res.json();
      setViewProduct(updated);
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err) {
      console.error(err);
      toast.error("Hubo un problema al actualizar el producto");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) {
      toast.error("No se encontró un ID válido del producto");
      return;
    }
    try {
      setLoading(true);
      const displayName = user?.username || user?.email || "ChemaSportER";
      const res = await fetch(
        `${API_BASE}/api/products/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-user": displayName },
        }
      );
      if (!res.ok) throw new Error("Error al eliminar");
      onUpdate?.(null, id);
      onClose?.();
    } catch (err) {
      toast.error("No se pudo eliminar el producto");
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (size, value) => {
    if (invMode === "stock") {
      setEditedStock((prev) => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
    } else {
      setEditedBodega((prev) => ({
        ...prev,
        [size]: parseInt(value, 10) || 0,
      }));
    }
  };

  const handleImageChange = (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato de imagen no soportado");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLocalImages((prev) => {
        const copy = prev.slice();
        if (index >= copy.length)
          copy.push({ src: reader.result, isNew: true });
        else copy[index] = { src: reader.result, isNew: true };
        return copy;
      });
      setIdx(index);
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = (index) => {
    setLocalImages((prev) => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
    setIdx(0);
  };

  const isNino =
    (isEditing ? editedType : viewProduct?.type) === "Niño";
  const isBalon =
    (isEditing ? editedType : viewProduct?.type) === "Balón" ||
    (isEditing ? editedType : viewProduct?.type) === "Balones";

  const tallasVisibles = isBalon
    ? TALLAS_BALON
    : isNino
    ? TALLAS_NINO
    : TALLAS_ADULTO;

  const displayUrl = currentSrc
    ? transformCloudinary(currentSrc, MODAL_IMG_MAX_W)
    : "";

  const getInventoryToShow = () => {
    if (isEditing)
      return invMode === "stock" ? editedStock : editedBodega;
    return invMode === "stock"
      ? viewProduct?.stock || {}
      : viewProduct?.bodega || {};
  };

  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice !== null &&
    Number(product.discountPrice) > 0;

  const getTotalBySize = (size) => {
    const a = parseInt(viewProduct?.stock?.[size] ?? 0, 10) || 0;
    const b = parseInt(viewProduct?.bodega?.[size] ?? 0, 10) || 0;
    return a + b;
  };

  return (
    <div 
        className={`mt-10 mb-16 fixed inset-0 z-50 flex items-center justify-center py-6 transition-colors duration-300 ${
            isOpen ? "bg-black/40 visible" : "bg-black/0 invisible"
        }`}
        onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()} 
        className={`relative bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 transition-all duration-300 transform ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-2 bg-black text-white rounded p-1 z-10 hover:bg-red-600 transition-colors"
          title="Cerrar"
        >
          <FaTimes size={24} />
        </button>

        <div className="mt-8 mb-4 text-center">
          {isEditing && canEdit ? (
            <>
              <label className="block text-xs text-gray-500 mb-1 font-bold uppercase tracking-wide">
                Tipo
              </label>
              <select
                value={editedType}
                onChange={(e) => setEditedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded mb-3 bg-gray-50 focus:ring-black focus:border-black font-semibold text-center"
              >
                {[
                  "Player",
                  "Fan",
                  "Mujer",
                  "Nacional",
                  "Abrigos",
                  "Retro",
                  "Niño",
                  "F1",
                  "NBA",
                  "MLB",
                  "NFL",
                  "Balón",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <label className="block text-xs text-gray-500 mb-1 font-bold uppercase tracking-wide">
                Nombre
              </label>
              <input
                type="text"
                className="text-center border-b-2 border-gray-300 w-full font-bold text-lg focus:border-black outline-none pb-1"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />

              <div className="flex justify-between gap-4 mt-4">
                  <div className="w-1/2">
                    <label className="block text-xs text-gray-500 mb-1 font-bold uppercase tracking-wide">
                        Precio
                    </label>
                    <input
                        type="number"
                        className="text-center border border-gray-300 rounded p-2 w-full font-bold text-lg focus:border-black outline-none"
                        value={editedPrice}
                        onChange={(e) => setEditedPrice(e.target.value)}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-xs text-green-600 mb-1 font-bold uppercase tracking-wide">
                        Descuento
                    </label>
                    <input
                        type="number"
                        className="text-center border border-green-300 bg-green-50 rounded p-2 w-full font-bold text-lg text-green-700 focus:border-green-600 outline-none"
                        value={editedDiscountPrice}
                        onChange={(e) => setEditedDiscountPrice(e.target.value)}
                    />
                  </div>
              </div>
            </>
          ) : (
            <>
              <span className="inline-block bg-black text-white px-3 py-1 rounded-full text-xs font-bold mb-2">
                {viewProduct?.type}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-gray-800 leading-tight">
                {viewProduct?.name}
              </h2>
            </>
          )}
        </div>

        {!isEditing ? (
          <div className="relative mb-6 flex items-center justify-center bg-gray-50 rounded-lg p-2">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={viewProduct?.name || "Producto"}
                className="rounded-lg max-h-[350px] object-contain drop-shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="h-[300px] w-full grid place-items-center text-gray-400 bg-gray-100 rounded-lg">
                <span className="font-semibold">Sin imagen</span>
              </div>
            )}

            {hasMany && (
              <>
                <button
                  onClick={() =>
                    setIdx(
                      (i) =>
                        (i - 1 + localImages.length) %
                        localImages.length
                    )
                  }
                  className="absolute left-2 z-10 bg-black/70 hover:bg-black text-white p-2 rounded-full transition-colors"
                >
                  <FaChevronLeft size={18} />
                </button>
                <button
                  onClick={() =>
                    setIdx(
                      (i) =>
                        (i + 1) % localImages.length
                    )
                  }
                  className="absolute right-2 z-10 bg-black/70 hover:bg-black text-white p-2 rounded-full transition-colors"
                >
                  <FaChevronRight size={18} />
                </button>
                
                {/* Indicador de imagen */}
                <div className="absolute bottom-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                    {idx + 1} / {localImages.length}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-4 justify-center flex-wrap mb-6 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
            {localImages.map((img, i) => {
              const thumbUrl = img?.src
                ? transformCloudinary(img.src, THUMB_MAX_W)
                : "";
              return (
                <div key={i} className="relative group">
                  <img
                    src={thumbUrl || img.src}
                    alt={`img-${i}`}
                    className="h-32 w-32 object-cover rounded shadow-sm"
                    loading="lazy"
                  />
                  <button
                    onClick={() => handleImageRemove(i)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 shadow-md hover:bg-red-700 transition-transform transform hover:scale-110"
                    title="Quitar"
                  >
                    <FaTimes size={12} />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-1 rounded-b">
                      <label className="text-white text-xs cursor-pointer hover:underline font-semibold">
                          Cambiar
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e, i)}
                          />
                      </label>
                  </div>
                </div>
              );
            })}
            {localImages.length < 2 && (
              <label className="h-32 w-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-400 text-gray-500 rounded cursor-pointer hover:bg-gray-100 transition-colors">
                <span className="text-2xl mb-1">+</span>
                <span className="text-xs font-semibold">Agregar Foto</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, localImages.length)}
                />
              </label>
            )}
          </div>
        )}

        {!isEditing && (
          <div className="mb-6 text-center">
            {hasDiscount ? (
              <div className="flex flex-col items-center justify-center">
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full mb-1 uppercase tracking-wider">
                      En Oferta
                  </span>
                  <div className="flex items-center gap-3">
                    <p className="line-through text-gray-400 text-lg">
                        ₡{Number(viewProduct.price).toLocaleString("de-DE")}
                    </p>
                    <p className="text-3xl font-black text-green-600 drop-shadow-sm">
                        ₡{Number(viewProduct.discountPrice).toLocaleString("de-DE")}
                    </p>
                  </div>
              </div>
            ) : (
              <p className="text-3xl font-black text-black">
                ₡{Number(viewProduct.price).toLocaleString("de-DE")}
              </p>
            )}
          </div>
        )}

        {/* ⭐ SECCIÓN DE INVENTARIO MEJORADA */}
        <div className="mb-6 border-t pt-4">
            
            {/* Si NO somos admin editando, mostramos vista normal */}
            {!canEdit || !isEditing ? (
                <>
                    <p className="text-center text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
                        Disponibilidad
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {tallasVisibles.map((size) => {
                            const total = getTotalBySize(size);
                            const isAgotado = total === 0;
                            return (
                                <div
                                    key={size}
                                    className={`text-center border rounded p-2 transition-colors ${
                                        isAgotado ? 'bg-gray-50 border-gray-200' : 'bg-white border-black shadow-sm'
                                    }`}
                                >
                                    <label className={`block text-base font-black ${isAgotado ? 'text-gray-400' : 'text-black'}`}>
                                        {size}
                                    </label>
                                    <p className={`text-xs mt-1 font-semibold ${
                                        isAgotado ? 'text-red-500' : total === 1 ? 'text-orange-500' : 'text-green-600'
                                    }`}>
                                        {isAgotado ? 'Agotado' : `${total} disp.`}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                /* 🔥 MODO EDICIÓN DE INVENTARIO SÚPER CLARO */
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-300">
                    <p className="text-center font-black text-gray-800 uppercase tracking-widest mb-3 text-sm">
                        Modificando Inventario
                    </p>
                    
                    {/* Botones de Tienda Gigantes */}
                    <div className="flex gap-2 mb-4">
                        <button
                            className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                                invMode === "stock" 
                                ? "bg-black border-black text-white shadow-lg transform scale-[1.02]" 
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
                            }`}
                            onClick={() => setInvMode("stock")}
                        >
                            <FaStore size={20} className="mb-1" />
                            <span className="font-bold text-sm">Tienda #1</span>
                        </button>
                        
                        <button
                            className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                                invMode === "bodega" 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg transform scale-[1.02]" 
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
                            }`}
                            onClick={() => setInvMode("bodega")}
                        >
                            <FaWarehouse size={20} className="mb-1" />
                            <span className="font-bold text-sm">Tienda #2</span>
                        </button>
                    </div>

                    {/* Contenedor de tallas coloreado según tienda */}
                    <div className={`p-4 rounded-lg border-2 shadow-inner transition-colors duration-300 ${
                        invMode === "stock" ? "bg-gray-100 border-gray-300" : "bg-indigo-50 border-indigo-200"
                    }`}>
                        <div className="flex items-center justify-center mb-4 text-sm font-bold">
                            Estás editando: 
                            <span className={`ml-2 px-2 py-1 rounded text-white ${invMode === "stock" ? "bg-black" : "bg-indigo-600"}`}>
                                {invMode === "stock" ? "TIENDA #1" : "TIENDA #2 (BODEGA)"}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {tallasVisibles.map((size) => {
                                const inv = getInventoryToShow();
                                const currentVal = inv[size] ?? 0;
                                return (
                                    <div key={size} className="relative">
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-2 rounded-full border border-gray-300 text-xs font-bold text-gray-700 shadow-sm z-10">
                                            {size}
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            className={`w-full h-12 pt-3 border-2 rounded-lg text-center font-black text-lg focus:outline-none transition-colors ${
                                                invMode === "stock" 
                                                ? "focus:border-black text-black" 
                                                : "focus:border-indigo-500 text-indigo-900"
                                            } ${currentVal === 0 ? 'bg-white opacity-60' : 'bg-white shadow-sm'}`}
                                            value={currentVal === 0 ? "" : currentVal}
                                            placeholder="0"
                                            onChange={(e) => handleStockChange(size, e.target.value)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {canEdit && isEditing && (
          <div className="mb-6 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
            <p className="text-xs text-yellow-800 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                ⚙️ Opciones del Sistema
            </p>
            
            <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-yellow-100 rounded transition-colors">
                <div className="relative flex items-center">
                    <input
                        type="checkbox"
                        checked={editedHidden}
                        onChange={(e) => setEditedHidden(e.target.checked)}
                        className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${editedHidden ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedHidden ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">Ocultar Producto</span>
                    <span className="text-xs text-gray-500">Nadie podrá verlo en la tienda.</span>
                </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-yellow-100 rounded transition-colors">
                <div className="relative flex items-center">
                    <input
                        type="checkbox"
                        checked={editedIsMundial2026}
                        onChange={(e) => setEditedIsMundial2026(e.target.checked)}
                        className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${editedIsMundial2026 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsMundial2026 ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">Torneo: Mundial 2026</span>
                    <span className="text-xs text-gray-500">Aparecerá en el filtro especial.</span>
                </div>
                </label>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 pt-6 pb-2">
          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            {canEdit && isEditing ? (
              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base rounded-lg font-black shadow-lg transition-transform transform hover:-translate-y-1"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
              </button>
            ) : canEdit ? (
              <button
                className="w-full bg-black hover:bg-gray-800 text-white py-3 text-base rounded-lg font-black shadow-md transition-colors"
                onClick={() => setIsEditing(true)}
              >
                MODIFICAR PRODUCTO
              </button>
            ) : null}

            {canDelete && (
              <button
                className="w-full bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 py-2 text-sm rounded-lg font-bold transition-colors"
                onClick={() => {
                  toastHOT(
                    (t) => (
                      <div className="text-center">
                        <p className="font-bold text-gray-800 mb-2">¿Eliminar este producto permanentemente?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              toastHOT.dismiss(t.id);
                              handleDelete();
                            }}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
                          >
                            Eliminar
                          </button>
                          <button
                            onClick={() => toastHOT.dismiss(t.id)}
                            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ),
                    { duration: 6000 }
                  );
                }}
                disabled={loading}
              >
                ELIMINAR PRODUCTO
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}