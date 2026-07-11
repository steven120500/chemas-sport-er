import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { FaChevronLeft, FaTimes, FaChevronRight, FaStore, FaWarehouse, FaLock } from "react-icons/fa";
import { toast as toastHOT } from "react-hot-toast";
import { io } from "socket.io-client"; // ⭐ 1. IMPORTAMOS SOCKET.IO

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

export default function ProductScreen({
  product,
  onClose,
  onUpdate,
  canEdit,
  canDelete,
  user,
  storeView = 'todos',
}) {
  const [viewProduct, setViewProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(false);
  const [invMode, setInvMode] = useState("stock");

  const [editedStock, setEditedStock] = useState(product.stock || {});
  const [editedBodega, setEditedBodega] = useState(product.bodega || {});
  const [editedName, setEditedName] = useState(product?.name || "");
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(product?.discountPrice ?? 0);
  const [editedType, setEditedType] = useState(product?.type || "Player");
  const [loading, setLoading] = useState(false);

  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);
  const [editedIsMundial2026, setEditedIsMundial2026] = useState(product?.isMundial2026 || false);

  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images.map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
    }
    return [product?.imageSrc, product?.imageSrc2].filter(Boolean);
  }, [product]);

  const [localImages, setLocalImages] = useState(
    galleryFromProduct.map((src) => ({ src, isNew: false }))
  );
  const [idx, setIdx] = useState(0);
  const hasMany = localImages.length > 1;
  const currentSrc = localImages[idx]?.src || "";

  // Variable de usuario para los bloqueos
  const displayName = user?.username || user?.email || "ChemaSportER";

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
        ? product.images.map((img) => ({ src: typeof img === "string" ? img : img.url, isNew: false }))
        : [
            ...(product?.imageSrc ? [{ src: product.imageSrc, isNew: false }] : []),
            ...(product?.imageSrc2 ? [{ src: product.imageSrc2, isNew: false }] : []),
          ]
    );
    setIdx(0);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  /* ⭐⭐⭐ 2. MAGIA DE WEBSOCKETS EN TIEMPO REAL ⭐⭐⭐ */
  useEffect(() => {
    const currentId = product?._id || product?.id;
    if (!currentId) return;

    // Conectamos al servidor de sockets
    const socket = io(API_BASE);

    // Escuchamos si alguien más actualiza un producto
    socket.on('productoActualizado', (productoFresco) => {
      const frescoId = productoFresco?._id || productoFresco?.id;
      
      // Si el producto que editaron es exactamente el que tenemos abierto en pantalla
      if (frescoId === currentId) {
        console.log("🟢 Actualización en tiempo real recibida para este producto");
        
        // Actualizamos todos los datos en pantalla instantáneamente
        setViewProduct(productoFresco);
        setEditedName(productoFresco?.name || "");
        setEditedPrice(productoFresco?.price ?? 0);
        setEditedDiscountPrice(productoFresco?.discountPrice ?? 0);
        setEditedType(productoFresco?.type || "Player");
        setEditedStock({ ...(productoFresco?.stock || {}) });
        setEditedBodega({ ...(productoFresco?.bodega || {}) });
        setEditedHidden(productoFresco?.hidden || false);
        setEditedIsMundial2026(productoFresco?.isMundial2026 || false);

        setLocalImages(
          productoFresco?.images?.length
            ? productoFresco.images.map((img) => ({ src: typeof img === "string" ? img : img.url, isNew: false }))
            : [
                ...(productoFresco?.imageSrc ? [{ src: productoFresco.imageSrc, isNew: false }] : []),
                ...(productoFresco?.imageSrc2 ? [{ src: productoFresco.imageSrc2, isNew: false }] : []),
              ]
        );

        // Avisamos al usuario para que sepa por qué cambiaron los números
        toast.info(
          "🔄 ¡Alguien más acaba de actualizar este producto! La pantalla se ha refrescado automáticamente con los últimos datos.",
          { position: "top-right", autoClose: 5000 }
        );
      }
    });

    // Limpiamos la conexión cuando cerramos la ventana
    return () => {
      socket.disconnect();
    };
  }, [product?._id, product?.id]);
  /* ⭐⭐⭐ FIN DE WEBSOCKETS ⭐⭐⭐ */

  // Liberar candado si cierran la pestaña de golpe o desmontan el componente
  useEffect(() => {
    const handleUnload = () => {
      if (isEditing) {
        navigator.sendBeacon(`${API_BASE}/api/products/${product?._id || product?.id}/unlock`);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (isEditing) unlockProduct(); 
    };
  }, [isEditing]);

  // Pedir permiso al backend antes de editar
  const lockProduct = async () => {
    const id = product?._id || product?.id;
    if (!id) return false;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user": displayName },
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(`🔒 ${data.lockedBy || 'Alguien'} ya está editando este producto.`);
        setLoading(false);
        return false;
      }
      setLoading(false);
      return true; 
    } catch (error) {
      toast.error("Error al conectar con el servidor.");
      setLoading(false);
      return false;
    }
  };

  // Soltar el candado manualmente
  const unlockProduct = async () => {
    const id = product?._id || product?.id;
    if (!id) return;
    try {
      await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user": displayName },
      });
    } catch (error) {
      console.error("Error desbloqueando el producto", error);
    }
  };

  const handleEditClick = async () => {
    const hasLock = await lockProduct();
    if (hasLock) {
      setIsEditing(true);
    }
  };

  const handleCancelEditClick = () => {
    setIsEditing(false);
    unlockProduct();
    setViewProduct(product); 
  };

  const handleSave = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) {
      toast.error("No se encontró un ID válido del producto");
      return;
    }

    try {
      setLoading(true);
      const priceInt = Math.max(0, parseInt(editedPrice, 10) || 0);
      const discountInt = Math.max(0, parseInt(editedDiscountPrice, 10) || 0);
      const clean = (obj) =>
        Object.fromEntries(
          Object.entries(obj || {}).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)])
        );

      const payload = {
        name: (editedName || "").trim(),
        price: priceInt,
        discountPrice: discountInt,
        type: (editedType || "").trim(),
        stock: clean(editedStock),
        bodega: clean(editedBodega),
        images: localImages.map((i) => i?.src).filter(Boolean),
        imageSrc: typeof localImages[0]?.src === "string" ? localImages[0].src : null,
        imageSrc2: typeof localImages[1]?.src === "string" ? localImages[1].src : null,
        imageAlt: (editedName || "").trim(),
        hidden: editedHidden,
        isMundial2026: editedIsMundial2026, 
      };

      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user": displayName },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 409) {
             throw new Error(`Producto bloqueado por ${errorData.lockedBy || 'otro usuario'}`);
        }
        throw new Error(`Error al actualizar (${res.status})`);
      }

      const updated = await res.json();
      setViewProduct(updated);
      setIsEditing(false);
      onUpdate?.(updated);
      toast.success("Cambios guardados correctamente.");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Hubo un problema al actualizar el producto");
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
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-user": displayName },
      });
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
      setEditedBodega((prev) => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
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
        if (index >= copy.length) copy.push({ src: reader.result, isNew: true });
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

  const isNino = (isEditing ? editedType : viewProduct?.type) === "Niño";
  const isBalon = (isEditing ? editedType : viewProduct?.type) === "Balón" || (isEditing ? editedType : viewProduct?.type) === "Balones";

  const tallasVisibles = isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO;
  const displayUrl = currentSrc ? transformCloudinary(currentSrc, MODAL_IMG_MAX_W) : "";

  const getInventoryToShow = () => {
    if (isEditing) return invMode === "stock" ? editedStock : editedBodega;
    return invMode === "stock" ? viewProduct?.stock || {} : viewProduct?.bodega || {};
  };

  const hasDiscount = product.discountPrice !== undefined && product.discountPrice !== null && Number(product.discountPrice) > 0;

  const getTotalBySize = (size) => {
    const a = parseInt(viewProduct?.stock?.[size] ?? 0, 10) || 0; 
    const b = parseInt(viewProduct?.bodega?.[size] ?? 0, 10) || 0; 
    if (storeView === 'tienda1') return a;
    if (storeView === 'tienda2') return b;
    return a + b; 
  };

  // Compara inventario viejo vs nuevo para mostrar diferencias
  const getInventoryChanges = () => {
    const changes = [];
    tallasVisibles.forEach((size) => {
      const oldStock = parseInt(viewProduct?.stock?.[size] ?? 0, 10);
      const newStock = parseInt(editedStock?.[size] ?? 0, 10);
      if (oldStock !== newStock) {
        changes.push(`Tienda #1 [${size}]: ${oldStock} ➔ ${newStock}`);
      }

      const oldBodega = parseInt(viewProduct?.bodega?.[size] ?? 0, 10);
      const newBodega = parseInt(editedBodega?.[size] ?? 0, 10);
      if (oldBodega !== newBodega) {
        changes.push(`Tienda #2 [${size}]: ${oldBodega} ➔ ${newBodega}`);
      }
    });
    return changes;
  };

  return (
    <div className="full bg-white pt-8 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
      
        {/* BOTÓN VOLVER */}
        <button
          onClick={() => {
            if (isEditing) unlockProduct();
            onClose();
          }}
          className="flex items-center gap-2 text-gray-500 bg-white hover:text-black transition-colors mb-8 font-bold uppercase tracking-widest text-xs"
        >
          <FaChevronLeft size={14} /> Volver al catálogo
        </button>

        {/* LAYOUT A 2 COLUMNAS (Pantalla grande) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          
          {/* COLUMNA IZQUIERDA: IMAGEN */}
          <div className="w-full">
            {!isEditing ? (
              <div className="relative flex items-center justify-center bg-gray-50/50 rounded-3xl p-6 border border-gray-100">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt={viewProduct?.name || "Producto"}
                    className="w-full max-h-[600px] object-contain drop-shadow-2xl rounded-2xl"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-[400px] w-full grid place-items-center text-gray-400 bg-gray-100 rounded-3xl">
                    <span className="font-semibold">Sin imagen</span>
                  </div>
                )}

                {hasMany && (
                  <>
                    <button
                      onClick={() => setIdx((i) => (i - 1 + localImages.length) % localImages.length)}
                      className="absolute left-4 z-10 bg-black backdrop-blur hover:bg-gray-800 text-white shadow-md p-4 rounded-full transition-all hover:scale-105"
                    >
                      <FaChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setIdx((i) => (i + 1) % localImages.length)}
                      className="absolute right-4 z-10 bg-black backdrop-blur hover:bg-gray-800 text-white shadow-md p-4 rounded-full transition-all hover:scale-105"
                    >
                      <FaChevronRight size={20} />
                    </button>
                    
                    <div className="absolute bottom-6 bg-black backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                        {idx + 1} / {localImages.length}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-4 justify-center flex-wrap bg-gray-50/50 p-8 rounded-3xl border border-gray-200">
                {localImages.map((img, i) => {
                  const thumbUrl = img?.src ? transformCloudinary(img.src, THUMB_MAX_W) : "";
                  return (
                    <div key={i} className="relative group">
                      <img
                        src={thumbUrl || img.src}
                        alt={`img-${i}`}
                        className="h-40 w-40 object-cover rounded-2xl shadow-sm border border-gray-200"
                        loading="lazy"
                      />
                      <button
                        onClick={() => handleImageRemove(i)}
                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2.5 shadow-lg hover:bg-red-600 transition-transform transform hover:scale-110"
                      >
                        <FaTimes size={12} />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-2.5 rounded-b-2xl">
                          <label className="text-white text-xs cursor-pointer font-bold tracking-wide">
                              CAMBIAR
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
                          </label>
                      </div>
                    </div>
                  );
                })}
                {localImages.length < 2 && (
                  <label className="h-40 w-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 rounded-2xl cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors">
                    <span className="text-3xl mb-1">+</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Añadir Foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, localImages.length)} />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: INFORMACIÓN */}
          <div className="w-full flex flex-col">
            
            <div className="mb-8">
              {isEditing && canEdit ? (
                <>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Tipo</label>
                  <select
                    value={editedType}
                    onChange={(e) => setEditedType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 bg-gray-50 focus:ring-2 focus:ring-black/5 focus:border-black font-semibold transition-all outline-none"
                  >
                    {["Player", "Fan", "Mujer", "Nacional", "Abrigos", "Retro", "Niño", "F1", "NBA", "MLB", "NFL", "Balón"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-black text-gray-900 focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all mb-4"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                  />

                  <div className="flex gap-4">
                      <div className="w-1/2">
                        <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Precio</label>
                        <input
                            type="number"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all"
                            value={editedPrice}
                            onChange={(e) => setEditedPrice(e.target.value)}
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-xs text-green-700 mb-1.5 font-bold uppercase tracking-widest ml-1">Descuento</label>
                        <input
                            type="number"
                            className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-lg font-bold text-green-700 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                            value={editedDiscountPrice}
                            onChange={(e) => setEditedDiscountPrice(e.target.value)}
                        />
                      </div>
                  </div>
                </>
              ) : (
                <>
                  <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 shadow-sm">
                    {viewProduct?.type}
                  </span>
                  <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-gray-900 leading-tight tracking-tight mb-6">
                    {viewProduct?.name}
                  </h1>

                  {hasDiscount ? (
                    <div className="flex flex-col items-start mb-6">
                        <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full mb-2 uppercase tracking-widest shadow-sm">
                            Oferta
                        </span>
                        <div className="flex items-end gap-4">
                          <p className="line-through text-gray-400 text-2xl font-medium pb-1">
                              ₡{Number(viewProduct.price).toLocaleString("de-DE")}
                          </p>
                          <p className="text-5xl font-black text-gray-900 tracking-tight">
                              ₡{Number(viewProduct.discountPrice).toLocaleString("de-DE")}
                          </p>
                        </div>
                    </div>
                  ) : (
                    <p className="text-5xl font-black text-gray-900 tracking-tight mb-6">
                      ₡{Number(viewProduct.price).toLocaleString("de-DE")}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mb-8">
                {!canEdit || !isEditing ? (
                    <>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            Selecciona una Talla {storeView === 'tienda1' ? '(Tienda #1)' : storeView === 'tienda2' ? '(Tienda #2)' : ''}
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                            {tallasVisibles.map((size) => {
                                const total = getTotalBySize(size);
                                const isAgotado = total === 0;
                                const isTienda2 = storeView === 'tienda2';

                                return (
                                    <div
                                        key={size}
                                        className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-2xl border-2 transition-all select-none overflow-hidden ${
                                            isAgotado 
                                            ? 'border-gray-100 bg-gray-50/50 opacity-60' 
                                            : isTienda2 
                                                ? 'border-purple-200 bg-purple-50/30 hover:border-purple-500 cursor-pointer shadow-sm'
                                                : 'border-gray-200 bg-white hover:border-black hover:shadow-md cursor-pointer shadow-sm'
                                        }`}
                                    >
                                        <span className={`text-base font-black z-10 ${isAgotado ? 'text-gray-300' : isTienda2 ? 'text-purple-900' : 'text-gray-900'}`}>
                                            {size}
                                        </span>
                                        
                                        {canEdit && (
                                            <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-widest z-10 ${
                                                isAgotado ? 'text-gray-300' : 'text-gray-500'
                                            }`}>
                                                {isAgotado ? 'Agotado' : `${total} disp.`}
                                            </span>
                                        )}

                                        {isAgotado && (
                                            <svg className="absolute inset-0 w-full h-full text-gray-300/80" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                            </svg>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                        <p className="text-center font-bold text-gray-400 uppercase tracking-widest mb-5 text-xs">
                            Modificando Inventario
                        </p>
                        
                        <div className="flex gap-3 mb-6">
                            <button
                                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                                    invMode === "stock" 
                                    ? "bg-black border-black text-white shadow-lg" 
                                    : "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                                }`}
                                onClick={() => setInvMode("stock")}
                            >
                                <FaStore size={22} className="mb-2" />
                                <span className="font-black text-xs uppercase tracking-wider">Tienda #1</span>
                            </button>
                            
                            <button
                                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                                    invMode === "bodega" 
                                    ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/30" 
                                    : "bg-white border-gray-200 text-gray-400 hover:border-purple-200 hover:text-purple-500"
                                }`}
                                onClick={() => setInvMode("bodega")}
                            >
                                <FaWarehouse size={22} className="mb-2" />
                                <span className="font-black text-xs uppercase tracking-wider">Tienda #2</span>
                            </button>
                        </div>

                        <div className={`p-5 rounded-2xl transition-colors duration-300 ${invMode === "stock" ? "bg-gray-50" : "bg-purple-50/50"}`}>
                            <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                                {tallasVisibles.map((size) => {
                                    const inv = getInventoryToShow();
                                    const currentVal = inv[size] ?? 0;

                                    const inputColors = invMode === "stock" 
                                        ? "focus:border-black text-black border-gray-200" 
                                        : "focus:border-purple-500 text-purple-900 border-purple-200";
                                    
                                    const labelColors = invMode === "stock" ? "text-gray-500" : "text-purple-600";

                                    return (
                                        <div key={size} className="relative mt-2">
                                            <div className={`absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-transparent px-2 text-[10px] font-black tracking-widest uppercase z-10 ${labelColors}`}>
                                                {size}
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                className={`w-full h-12 pt-1 border bg-white rounded-2xl text-center font-black text-lg focus:outline-none focus:ring-0 transition-all ${inputColors} ${currentVal === 0 ? 'opacity-60 hover:opacity-100 shadow-sm' : 'shadow-md'}`}
                                                value={currentVal}
                                                placeholder="0"
                                                onWheel={(e) => e.target.blur()}
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
              <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-4">
                    Opciones del Sistema
                </p>
                <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input type="checkbox" checked={editedHidden} onChange={(e) => setEditedHidden(e.target.checked)} className="sr-only" />
                        <div className={`w-11 h-6 rounded-full transition-colors ${editedHidden ? 'bg-black' : 'bg-gray-300'}`}></div>
                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedHidden ? 'transform translate-x-5' : ''}`}></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-800">Ocultar Producto</span>
                        <span className="text-xs text-gray-400 font-medium">Nadie podrá verlo en la tienda.</span>
                    </div>
                    </label>

                    <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input type="checkbox" checked={editedIsMundial2026} onChange={(e) => setEditedIsMundial2026(e.target.checked)} className="sr-only" />
                        <div className={`w-11 h-6 rounded-full transition-colors ${editedIsMundial2026 ? 'bg-black' : 'bg-gray-300'}`}></div>
                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsMundial2026 ? 'transform translate-x-5' : ''}`}></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-800">Torneo: Mundial 2026</span>
                        <span className="text-xs text-gray-400 font-medium">Aparecerá en el filtro especial.</span>
                    </div>
                    </label>
                </div>
              </div>
            )}

            <div className="mt-auto">
              <div className="flex flex-col gap-3">
                {canEdit && isEditing ? (
                  <>
                    <button
                        className="w-full bg-black hover:bg-gray-900 text-white py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-lg transition-transform transform hover:-translate-y-0.5"
                        onClick={() => {
                            const inventoryChanges = getInventoryChanges();
                            toastHOT(
                            (t) => (
                                <div className="text-center p-2">
                                <p className="font-black text-gray-800 mb-2 text-base">¿Seguro que quieres guardar estos cambios?</p>
                                
                                {inventoryChanges.length > 0 ? (
                                    <div className="text-left bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 text-xs font-mono text-gray-700 max-h-32 overflow-y-auto shadow-inner">
                                        {inventoryChanges.map((change, i) => (
                                        <div key={i} className="py-1">{change}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 mb-4 font-medium">Se actualizarán los datos generales del producto.</p>
                                )}

                                <div className="flex gap-3 justify-center mt-2">
                                    <button
                                    onClick={() => {
                                        toastHOT.dismiss(t.id);
                                        handleSave();
                                    }}
                                    className="bg-black text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-800"
                                    >
                                    SÍ, GUARDAR
                                    </button>
                                    <button
                                    onClick={() => toastHOT.dismiss(t.id)}
                                    className="bg-gray-100 text-gray-800 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-200"
                                    >
                                    CANCELAR
                                    </button>
                                </div>
                                </div>
                            ),
                            { duration: 8000 }
                            );
                        }}
                        disabled={loading}
                    >
                        {loading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
                    </button>

                    <button
                        className="w-full bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase transition-colors"
                        onClick={handleCancelEditClick}
                        disabled={loading}
                    >
                        CANCELAR EDICIÓN
                    </button>
                  </>
                ) : canEdit ? (
                  <button
                    className="w-full bg-black hover:bg-gray-900 text-white flex items-center justify-center gap-2 py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-lg transition-transform transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleEditClick}
                    disabled={loading}
                  >
                    {loading ? "PROCESANDO..." : "MODIFICAR PRODUCTO"}
                  </button>
                ) : null}

                {canDelete && !isEditing && (
                  <button
                    className="w-full bg-white border border-red-100 text-red-500 hover:bg-red-50 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase transition-colors"
                    onClick={() => {
                      toastHOT(
                        (t) => (
                          <div className="text-center p-2">
                            <p className="font-black text-gray-800 mb-4 text-base">¿Eliminar este producto?</p>
                            <div className="flex gap-3 justify-center">
                              <button
                                onClick={() => {
                                  toastHOT.dismiss(t.id);
                                  handleDelete();
                                }}
                                className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-red-700"
                              >
                                ELIMINAR
                              </button>
                              <button
                                onClick={() => toastHOT.dismiss(t.id)}
                                className="bg-gray-100 text-gray-800 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-200"
                              >
                                CANCELAR
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
      </div>

      <style>{`
        @keyframes fadeInUpScreen {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUpScreen 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}