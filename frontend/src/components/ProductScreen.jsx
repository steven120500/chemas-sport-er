import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { io } from "socket.io-client";
import ProductAdminEditor from "./ProductAdminEditor"; // 👈 IMPORTAMOS EL NUEVO EDITOR

const API_BASE = "https://chemas-sport-er-backend.onrender.com";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const MODAL_IMG_MAX_W = 800;

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
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);

  const displayName = user?.username || user?.email || "ChemaSportER";

  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(viewProduct?.images) && viewProduct.images.length > 0) {
      return viewProduct.images.map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
    }
    return [viewProduct?.imageSrc, viewProduct?.imageSrc2].filter(Boolean);
  }, [viewProduct]);

  useEffect(() => {
    setViewProduct(product);
    setIdx(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  /* ⭐ SOCKETS EN TIEMPO REAL BLINDADOS Y ACTUALIZADOS ⭐ */
  useEffect(() => {
    const currentId = product?._id || product?.id;
    if (!currentId || isEditing) return;

    const hasAdminRole = user?.isSuperUser || user?.isAdmin || (Array.isArray(user?.roles) && user.roles.length > 0);
    if (!hasAdminRole) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3
    });

    socket.on('productoActualizado', (productoFresco) => {
      const frescoId = productoFresco?._id || productoFresco?.id;
      if (frescoId === currentId && !isEditing) {
        setViewProduct(productoFresco);
        const meta = productoFresco._lastEditMeta || {};
        const txtTienda = meta.store ? ` en ${meta.store}` : "";
        const txtCliente = meta.customer && meta.customer !== "No especificado" ? ` (Cliente: ${meta.customer})` : "";
        toast.info(
          `¡${meta.user || "Alguien"} ${meta.action || "actualizó"}${txtTienda}!${txtCliente} Pantalla actualizada.`,
          { position: "top-center", autoClose: 4000 }
        );
      }
    });

    return () => { socket.disconnect(); };
  }, [product?._id, product?.id, isEditing, user]);

  useEffect(() => {
    const handleUnload = () => { if (isEditing) navigator.sendBeacon(`${API_BASE}/api/products/${product?._id || product?.id}/unlock`); };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (isEditing) unlockProduct(); 
    };
  }, [isEditing]);

  const unlockProduct = async () => {
    const id = product?._id || product?.id;
    if (!id) return;
    try {
      await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}/unlock`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user": displayName },
      });
    } catch (error) { console.error("Error", error); }
  };

  const handleEditClick = async () => {
    const id = product?._id || product?.id;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}/lock`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-user": displayName },
      });
      const data = await res.json();
      if (!res.ok) {
        setIsEditing(false);
        toast.error(`Producto bloqueado por ${data.lockedBy || 'otro usuario'}.`);
        setLoading(false);
        return;
      }
      setIsEditing(true);
      if (data.product) setViewProduct(data.product);
    } catch (err) {
      toast.error("Error al verificar bloqueo.");
    }
    setLoading(false);
  };

  const handleCancelEditClick = () => {
    setIsEditing(false);
    unlockProduct();
  };

  const handleSaveSuccess = (updatedProduct) => {
    setViewProduct(updatedProduct);
    setIsEditing(false);
    if (onUpdate) onUpdate(updatedProduct);
  };

  const handleDeleteSuccess = (id) => {
    if (onUpdate) onUpdate(null, id);
    onClose();
  };

  const isNino = viewProduct?.type === "Niño";
  const isBalon = viewProduct?.type === "Balón" || viewProduct?.type === "Balones";
  const tallasVisibles = isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO;
  const displayUrl = galleryFromProduct[idx] ? transformCloudinary(galleryFromProduct[idx], MODAL_IMG_MAX_W) : "";
  const hasDiscount = viewProduct?.discountPrice !== undefined && viewProduct?.discountPrice !== null && Number(viewProduct?.discountPrice) > 0;
  const hasMany = galleryFromProduct.length > 1;

  const getTotalBySize = (size) => {
    const a = parseInt(viewProduct?.stock?.[size] ?? 0, 10) || 0; 
    const b = parseInt(viewProduct?.bodega?.[size] ?? 0, 10) || 0; 
    if (storeView === 'tienda1') return a;
    if (storeView === 'tienda2') return b;
    return a + b; 
  };

  return (
    <div className="full bg-white pt-8 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => { if (isEditing) unlockProduct(); onClose(); }}
          className="flex items-center gap-2 text-gray-500 bg-white hover:text-black transition-colors mb-8 font-bold uppercase tracking-widest text-xs cursor-pointer"
        >
          <FaChevronLeft size={14} /> Volver al catálogo
        </button>

        {isEditing ? (
          // 👈 AQUI LLAMAMOS AL NUEVO COMPONENTE ADMIN
          <ProductAdminEditor 
            product={product}
            viewProduct={viewProduct}
            API_BASE={API_BASE}
            displayName={displayName}
            onCancel={handleCancelEditClick}
            onSaveSuccess={handleSaveSuccess}
            onDeleteSuccess={handleDeleteSuccess}
            canDelete={canDelete}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* LADO IZQUIERDO: GALERÍA DE VISUALIZACIÓN */}
            <div className="w-full">
              <div className="relative flex items-center justify-center bg-gray-50/50 rounded-3xl p-6 border border-gray-100">
                {displayUrl ? (
                  <img src={displayUrl} alt={viewProduct?.name || "Producto"} className="w-full max-h-[600px] object-contain drop-shadow-2xl rounded-2xl" loading="lazy" />
                ) : (
                  <div className="h-[400px] w-full grid place-items-center text-gray-400 bg-gray-100 rounded-3xl"><span className="font-semibold">Sin imagen</span></div>
                )}
                {hasMany && (
                  <>
                    <button onClick={() => setIdx((i) => (i - 1 + galleryFromProduct.length) % galleryFromProduct.length)} className="absolute left-4 z-10 bg-black text-white p-4 rounded-full transition-all hover:scale-105 cursor-pointer"><FaChevronLeft size={20} /></button>
                    <button onClick={() => setIdx((i) => (i + 1) % galleryFromProduct.length)} className="absolute right-4 z-10 bg-black text-white p-4 rounded-full transition-all hover:scale-105 cursor-pointer"><FaChevronRight size={20} /></button>
                    <div className="absolute bottom-6 bg-black text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">{idx + 1} / {galleryFromProduct.length}</div>
                  </>
                )}
              </div>
            </div>

            {/* LADO DERECHO: INFO Y TALLAS */}
            <div className="w-full flex flex-col">
              <div className="mb-8">
                <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 shadow-sm">{viewProduct?.type}</span>
                <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-gray-900 leading-tight tracking-tight mb-6">{viewProduct?.name}</h1>
                {hasDiscount ? (
                  <div className="flex flex-col items-start mb-6">
                      <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full mb-2 uppercase tracking-widest">Oferta</span>
                      <div className="flex items-end gap-4">
                        <p className="line-through text-gray-400 text-2xl font-medium pb-1">₡{Number(viewProduct.price).toLocaleString("de-DE")}</p>
                        <p className="text-5xl font-black text-gray-900 tracking-tight">₡{Number(viewProduct.discountPrice).toLocaleString("de-DE")}</p>
                      </div>
                  </div>
                ) : (
                  <p className="text-5xl font-black text-gray-900 tracking-tight mb-6">₡{Number(viewProduct.price).toLocaleString("de-DE")}</p>
                )}
              </div>

              <div className="mb-8">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">Selecciona una Talla {storeView === 'tienda1' ? '(Tienda #1)' : storeView === 'tienda2' ? '(Tienda #2)' : ''}</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {tallasVisibles.map((size) => {
                      const total = getTotalBySize(size);
                      const isAgotado = total === 0;
                      const isTienda2 = storeView === 'tienda2';
                      return (
                          <div key={size} className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-2xl border-2 transition-all select-none overflow-hidden ${isAgotado ? 'border-gray-100 bg-gray-50/50 opacity-60' : isTienda2 ? 'border-purple-200 bg-purple-50/30 shadow-sm' : 'border-gray-200 bg-white shadow-sm'}`}>
                              <span className={`text-base font-black z-10 ${isAgotado ? 'text-gray-300' : isTienda2 ? 'text-purple-900' : 'text-gray-900'}`}>{size}</span>
                              {canEdit && <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-widest z-10 ${isAgotado ? 'text-gray-300' : 'text-gray-500'}`}>{isAgotado ? 'Agotado' : `${total} disp.`}</span>}
                              {isAgotado && <svg className="absolute inset-0 w-full h-full text-gray-300/80" preserveAspectRatio="none" viewBox="0 0 100 100"><line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
                          </div>
                      );
                  })}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex flex-col gap-3">
                  {canEdit && (
                    <button onClick={handleEditClick} disabled={loading} className="w-full bg-black hover:bg-gray-900 text-white flex items-center justify-center gap-2 py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-lg cursor-pointer disabled:opacity-50">
                      {loading ? "PROCESANDO..." : "MODIFICAR PRODUCTO"}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="w-full bg-white border border-red-100 text-red-500 hover:bg-red-50 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase cursor-pointer"
                      disabled={loading}
                      onClick={() => {
                        toastHOT(
                          (t) => (
                            <div className="text-center p-2">
                              <p className="font-black text-gray-800 mb-4 text-base">¿Eliminar este producto?</p>
                              <div className="flex gap-3 justify-center">
                                <button
                                  onClick={() => {
                                    toastHOT.dismiss(t.id);
                                    // Disparamos la lógica de borrar optimista llamando al backend
                                    onUpdate?.(null, product._id || product.id);
                                    onClose?.();
                                    fetch(`${API_BASE}/api/products/${encodeURIComponent(product._id || product.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json", "x-user": displayName }});
                                  }}
                                  className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-red-700 cursor-pointer"
                                >
                                  ELIMINAR
                                </button>
                                <button onClick={() => toastHOT.dismiss(t.id)} className="bg-gray-100 text-gray-800 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-200 cursor-pointer">CANCELAR</button>
                              </div>
                            </div>
                          ), { duration: 6000 }
                        );
                      }}
                    >
                      ELIMINAR PRODUCTO
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}