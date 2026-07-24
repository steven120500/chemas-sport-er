import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaStore, FaWarehouse } from "react-icons/fa";

const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const TALLAS_NINO = ["16", "18", "20", "22", "24", "26", "28"];
const TALLAS_BALON = ["3", "4", "5"];
const ACCEPTED_TYPES = ["image/png", "image/jpg", "image/jpeg", "image/heic"];
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

export default function ProductAdminEditor({
  product,
  viewProduct,
  API_BASE,
  displayName,
  onCancel,
  onSaveSuccess,
  onDeleteSuccess,
  canDelete,
}) {
  const [invMode, setInvMode] = useState("stock");
  const [editedStock, setEditedStock] = useState(product?.stock || {});
  const [editedBodega, setEditedBodega] = useState(product?.bodega || {});
  const [editedName, setEditedName] = useState(product?.name || "");
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(product?.discountPrice ?? 0);
  const [editedType, setEditedType] = useState(product?.type || "Player");
  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);
  const [editedIsMundial2026, setEditedIsMundial2026] = useState(product?.isMundial2026 || false);
  // 🔥 1. NUEVO ESTADO PARA EL SELLO DE TEMPORADA 26-27 🔥
  const [editedIsTemporada2627, setEditedIsTemporada2627] = useState(product?.isTemporada2627 || false);
  
  const [loading, setLoading] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerName, setBuyerName] = useState("");

  const [localImages, setLocalImages] = useState([]);

  useEffect(() => {
    setLocalImages(
      product?.images?.length
        ? product.images.map((img) => ({ src: typeof img === "string" ? img : img.url, isNew: false }))
        : [
            ...(product?.imageSrc ? [{ src: product.imageSrc, isNew: false }] : []),
            ...(product?.imageSrc2 ? [{ src: product.imageSrc2, isNew: false }] : []),
          ]
    );
  }, [product]);

  const isNino = editedType === "Niño";
  const isBalon = editedType === "Balón" || editedType === "Balones";
  const tallasVisibles = isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO;

  const handleStockChange = (size, value) => {
    if (invMode === "stock") {
      setEditedStock((prev) => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
    } else {
      setEditedBodega((prev) => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
    }
  };

  const handleImageChange = (e, index) => {
    const file = e.target.files?.[0];
    if (!file || !ACCEPTED_TYPES.includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLocalImages((prev) => {
        const copy = prev.slice();
        if (index >= copy.length) copy.push({ src: reader.result, isNew: true });
        else copy[index] = { src: reader.result, isNew: true };
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = (index) => {
    setLocalImages((prev) => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
  };

  const getInventoryChanges = () => {
    const changes = [];
    tallasVisibles.forEach((size) => {
      const oldStock = parseInt(viewProduct?.stock?.[size] ?? 0, 10);
      const newStock = parseInt(editedStock?.[size] ?? 0, 10);
      if (oldStock !== newStock) changes.push(`Tienda #1 [${size}]: ${oldStock} -> ${newStock}`);

      const oldBodega = parseInt(viewProduct?.bodega?.[size] ?? 0, 10);
      const newBodega = parseInt(editedBodega?.[size] ?? 0, 10);
      if (oldBodega !== newBodega) changes.push(`Tienda #2 [${size}]: ${oldBodega} -> ${newBodega}`);
    });
    return changes;
  };

  const checkHasDeduction = () => {
    let decreased = false;
    tallasVisibles.forEach((size) => {
      if (parseInt(viewProduct?.stock?.[size] ?? 0, 10) > parseInt(editedStock?.[size] ?? 0, 10)) decreased = true;
      if (parseInt(viewProduct?.bodega?.[size] ?? 0, 10) > parseInt(editedBodega?.[size] ?? 0, 10)) decreased = true;
    });
    return decreased;
  };

  const handleSave = async (clientName = "") => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) return toast.error("ID de producto inválido");

    try {
      setLoading(true);
      const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)]));
      const cleanStock = clean(editedStock);
      const cleanBodega = clean(editedBodega);

      // 🔥 2. SE AGREGÓ isTemporada2627 AL PAYLOAD PARA EL BACKEND 🔥
      const payload = {
        name: editedName.trim(), 
        price: Math.max(0, parseInt(editedPrice, 10) || 0),
        discountPrice: Math.max(0, parseInt(editedDiscountPrice, 10) || 0), 
        type: editedType.trim(),
        stock: cleanStock, 
        bodega: cleanBodega,
        images: localImages.map((i) => i?.src).filter(Boolean),
        imageSrc: typeof localImages[0]?.src === "string" ? localImages[0].src : null,
        imageSrc2: typeof localImages[1]?.src === "string" ? localImages[1].src : null,
        imageAlt: editedName.trim(), 
        hidden: editedHidden, 
        isMundial2026: editedIsMundial2026,
        isTemporada2627: editedIsTemporada2627, 
        customerName: clientName,
      };

      let tiendaModificada = [];
      const stockViejo = viewProduct?.stock || {};
      const bodegaVieja = viewProduct?.bodega || {};
      
      if (tallasVisibles.some((size) => parseInt(stockViejo[size] ?? 0, 10) !== parseInt(cleanStock[size] ?? 0, 10))) tiendaModificada.push("Tienda #1");
      if (tallasVisibles.some((size) => parseInt(bodegaVieja[size] ?? 0, 10) !== parseInt(cleanBodega[size] ?? 0, 10))) tiendaModificada.push("Tienda #2");
      const etiquetaTienda = tiendaModificada.length > 0 ? tiendaModificada.join(" y ") : "";

      const localUpdatedProduct = { ...viewProduct, ...payload };
      onSaveSuccess(localUpdatedProduct); // Cierra y actualiza la vista local al instante
      toast.success(etiquetaTienda ? `Cambio realizado en ${etiquetaTienda} correctamente.` : "Cambios guardados correctamente.");

      // Sincronización silenciosa
      fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json", "x-user": displayName },
        body: JSON.stringify(payload),
      }).catch((err) => console.error("Error servidor:", err));

    } catch (err) {
      setLoading(false);
      toast.error("Error al procesar datos");
    }
  };

  const handleDelete = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) return toast.error("ID inválido");

    try {
      setLoading(true);
      onDeleteSuccess(id); // Cierra y actualiza parent
      toast.success("Producto eliminado correctamente.");

      fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json", "x-user": displayName },
      }).catch((err) => console.error("Error servidor:", err));
    } catch (err) {
      setLoading(false);
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      {/* CUADRICULA DE IMÁGENES Y FORMULARIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start w-full">
        <div className="w-full">
          <div className="flex gap-4 justify-center flex-wrap bg-gray-50/50 p-8 rounded-3xl border border-gray-200">
            {localImages.map((img, i) => {
              const thumbUrl = img?.src ? transformCloudinary(img.src, THUMB_MAX_W) : "";
              return (
                <div key={i} className="relative group">
                  <img src={thumbUrl || img.src} alt={`img-${i}`} className="h-40 w-40 object-cover rounded-2xl shadow-sm border border-gray-200" />
                  <button onClick={() => handleImageRemove(i)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2.5 shadow-lg hover:bg-red-600 cursor-pointer">
                    <FaTimes size={12} />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-2.5 rounded-b-2xl">
                    <label className="text-white text-xs cursor-pointer font-bold tracking-wide">
                      CAMBIAR
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
                    </label>
                  </div>
                </div>
              );
            })}
            {localImages.length < 2 && (
              <label className="h-40 w-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 rounded-2xl cursor-pointer hover:bg-gray-100">
                <span className="text-3xl mb-1">+</span>
                <span className="text-xs font-bold uppercase tracking-wider">Añadir Foto</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, localImages.length)} />
              </label>
            )}
          </div>
        </div>

        <div className="w-full flex flex-col">
          <div className="mb-8">
            <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Tipo</label>
            <select value={editedType} onChange={(e) => setEditedType(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 bg-gray-50 font-semibold outline-none cursor-pointer">
              {["Player", "Fan", "Mujer", "Nacional", "Abrigos", "Retro", "Niño", "F1", "NBA", "MLB", "NFL", "Balón"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Nombre</label>
            <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-black text-gray-900 outline-none mb-4" value={editedName} onChange={(e) => setEditedName(e.target.value)} />

            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Precio</label>
                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold outline-none" value={editedPrice} onChange={(e) => setEditedPrice(e.target.value)} />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-green-700 mb-1.5 font-bold uppercase tracking-widest ml-1">Descuento</label>
                <input type="number" className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-lg font-bold text-green-700 outline-none" value={editedDiscountPrice} onChange={(e) => setEditedDiscountPrice(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <p className="text-center font-bold text-gray-400 uppercase tracking-widest mb-5 text-xs">Modificando Inventario</p>
              <div className="flex gap-3 mb-6">
                <button className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer ${invMode === "stock" ? "bg-black border-black text-white shadow-lg" : "bg-white border-gray-200 text-gray-400"}`} onClick={() => setInvMode("stock")}>
                  <FaStore size={22} className="mb-2" />
                  <span className="font-black text-xs uppercase tracking-wider">Tienda #1</span>
                </button>
                <button className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer ${invMode === "bodega" ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/30" : "bg-white border-gray-200 text-gray-400"}`} onClick={() => setInvMode("bodega")}>
                  <FaWarehouse size={22} className="mb-2" />
                  <span className="font-black text-xs uppercase tracking-wider">Tienda #2</span>
                </button>
              </div>

              <div className={`p-5 rounded-2xl transition-colors duration-300 ${invMode === "stock" ? "bg-gray-50" : "bg-purple-50/50"}`}>
                <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                  {tallasVisibles.map((size) => {
                    const currentVal = (invMode === "stock" ? editedStock : editedBodega)[size] ?? 0;
                    const inputColors = invMode === "stock" ? "focus:border-black text-black border-gray-200" : "focus:border-purple-500 text-purple-900 border-purple-200";
                    const labelColors = invMode === "stock" ? "text-gray-500" : "text-purple-600";

                    return (
                      <div key={size} className="relative mt-2">
                        <div className={`absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-transparent px-2 text-[10px] font-black tracking-widest uppercase z-10 ${labelColors}`}>{size}</div>
                        <input type="number" min="0" className={`w-full h-12 pt-1 border bg-white rounded-2xl text-center font-black text-lg focus:outline-none transition-all ${inputColors} ${currentVal === 0 ? 'opacity-60 shadow-sm' : 'shadow-md'}`} value={currentVal} placeholder="0" onWheel={(e) => e.target.blur()} onChange={(e) => handleStockChange(size, e.target.value)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-4">Opciones del Sistema</p>
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

              {/* 🔥 3. NUEVA OPCIÓN EN INTERFAZ: TEMPORADA 26-27 (SELLO ROJO) 🔥 */}
              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={editedIsTemporada2627} onChange={(e) => setEditedIsTemporada2627(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${editedIsTemporada2627 ? 'bg-red-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsTemporada2627 ? 'transform translate-x-5' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-gray-800">Temporada 26-27</span>
                  <span className="text-xs text-gray-400 font-medium">Muestra el sello circular vintage en la chema.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              className="w-full bg-black hover:bg-gray-900 text-white py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-lg transition-transform cursor-pointer"
              onClick={() => {
                const changes = getInventoryChanges();
                toastHOT(
                  (t) => (
                    <div className="text-center p-2">
                      <p className="font-black text-gray-800 mb-2 text-base">¿Seguro que quieres guardar estos cambios?</p>
                      {changes.length > 0 ? (
                        <div className="text-left bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 text-xs font-mono text-gray-700 max-h-32 overflow-y-auto shadow-inner">
                          {changes.map((change, i) => (<div key={i} className="py-1">{change}</div>))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mb-4 font-medium">Se actualizarán los datos generales.</p>
                      )}
                      <div className="flex gap-3 justify-center mt-2">
                        <button onClick={() => { toastHOT.dismiss(t.id); if (checkHasDeduction()) setShowBuyerModal(true); else handleSave(""); }} className="bg-black text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-800 cursor-pointer">SÍ, GUARDAR</button>
                        <button onClick={() => toastHOT.dismiss(t.id)} className="bg-gray-100 text-gray-800 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-200 cursor-pointer">CANCELAR</button>
                      </div>
                    </div>
                  ), { duration: 8000 }
                );
              }}
              disabled={loading}
            >
              {loading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
            </button>
            <button className="w-full bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase cursor-pointer" onClick={onCancel} disabled={loading}>
              CANCELAR EDICIÓN
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE COMPRADOR */}
      {showBuyerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 flex flex-col items-center text-center relative">
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-4 shadow-lg text-2xl">👤</div>
            <h3 className="text-xl font-black text-gray-900 mb-1">¿Quién compró esta camiseta?</h3>
            <p className="text-xs text-gray-500 mb-6 font-medium leading-relaxed">Notamos que rebajaste existencias del inventario. Ingresa el nombre del cliente para dejarlo registrado.</p>
            <div className="w-full relative mb-6">
              <input type="text" placeholder="Ej: Emanuel Espinoza" className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl font-bold text-gray-800 text-center text-sm focus:border-black focus:outline-none shadow-inner bg-gray-50/50" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-3 w-full">
              <button type="button" onClick={() => { setShowBuyerModal(false); handleSave(buyerName || "Cliente General / Tienda"); setBuyerName(""); }} disabled={loading} className="flex-1 bg-black text-white font-black py-4 rounded-2xl text-xs tracking-widest uppercase shadow-lg cursor-pointer">CONFIRMAR</button>
              <button type="button" onClick={() => { setShowBuyerModal(false); handleSave("No especificado"); setBuyerName(""); }} disabled={loading} className="px-5 bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl text-xs uppercase tracking-wider cursor-pointer">Omitir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}