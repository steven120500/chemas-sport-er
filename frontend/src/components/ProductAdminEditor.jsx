import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { toast as toastHOT } from "react-hot-toast";
import { FaTimes, FaStore, FaWarehouse, FaBoxOpen, FaPlus, FaTshirt, FaUser, FaCheck } from "react-icons/fa";
import ModalShell from "./ModalShell";

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
    const transforms = `f_auto,q_auto:eco,c_limit,w_${maxW}`;
    u.pathname = `${parts[0]}/upload/${transforms}/${parts[1]}`;
    return u.toString();
  } catch {
    return url;
  }
}

// 💸 Comprime la foto en el navegador antes de subirla (igual que AddProductModal):
// máx. 1000px de ancho, WebP calidad 0.75. Si el navegador no puede (ej. HEIC en Chrome),
// devuelve la original y el backend la limita igual al subirla a Cloudinary.
async function compressToDataUrl(file, maxWidth = 1000, quality = 0.75) {
  const original = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Formato no soportado por el navegador"));
      i.src = original;
    });
    const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", quality);
    const out = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
    return out.length < original.length ? out : original;
  } catch {
    return original;
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
  user,
}) {
  const [invMode, setInvMode] = useState("stock"); 
  const [editedTienda, setEditedTienda] = useState(product?.tienda || {}); 
  const [editedStock, setEditedStock] = useState(product?.stock || {}); 
  const [editedBodega, setEditedBodega] = useState(product?.bodega || {}); 
  
  const [editedName, setEditedName] = useState(product?.name || "");
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(product?.discountPrice ?? 0);
  const [editedType, setEditedType] = useState(product?.type || "Player");
  
  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);
  const [editedIsMundial2026, setEditedIsMundial2026] = useState(product?.isMundial2026 || false);
  const [editedIsTemporada2627, setEditedIsTemporada2627] = useState(product?.isTemporada2627 || false);
  
  // 🔥 ESTADOS DE DORSALES DINÁMICOS 🔥
  const [editedIsNumerable, setEditedIsNumerable] = useState(product?.isNumerable || false);
  const [editedTeamFont, setEditedTeamFont] = useState(product?.teamFont || "barca");
  const [editedDorsalOptions, setEditedDorsalOptions] = useState(() => {
    if (Array.isArray(product?.dorsalOptions) && product.dorsalOptions.length > 0) {
      return product.dorsalOptions.map((opt) => ({
        name: opt?.name || "",
        number: opt?.number || "",
        quantity: opt?.quantity ?? "",
        imageUrl: opt?.imageUrl || "",
      }));
    }
    return [
      { name: "", number: "", quantity: "", imageUrl: "" },
      { name: "", number: "", quantity: "", imageUrl: "" },
      { name: "", number: "", quantity: "", imageUrl: "" },
    ];
  });

  // ✍️ Impresiones como estaban al abrir el editor: el backend compara contra esto para saber qué se cambió a mano
  // (y copiarlo a la hermana Player/Fan) sin pisar ventas que pasen mientras el editor está abierto.
  const [dorsalOptionsBase] = useState(() =>
    (Array.isArray(product?.dorsalOptions) ? product.dorsalOptions : [])
      .filter((o) => o && (o.name || o.number))
      .map((o) => ({ name: o.name || "", number: o.number || "", quantity: o.quantity ?? 0 }))
  );

  // 👕 IMPRESIÓN DE CADA CAMISETA REBAJADA: un índice de dorsalOptions por camiseta ("" = sin impresión)
  const [purchasedDorsalIdxs, setPurchasedDorsalIdxs] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [confirmCommission, setConfirmCommission] = useState(false); 
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
  const isLlavero = editedType === "Llaveros" || editedType === "LEGO"; // por unidad (talla U)
  const tallasVisibles = isLlavero ? ["U"] : (isBalon ? TALLAS_BALON : isNino ? TALLAS_NINO : TALLAS_ADULTO);

  const handleStockChange = (size, value) => {
    const val = parseInt(value, 10) || 0;
    if (invMode === "tienda") setEditedTienda(prev => ({ ...prev, [size]: val }));
    else if (invMode === "stock") setEditedStock(prev => ({ ...prev, [size]: val }));
    else setEditedBodega(prev => ({ ...prev, [size]: val }));
  };

  const handleImageChange = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file || !ACCEPTED_TYPES.includes(file.type)) return;
    let src;
    try {
      src = await compressToDataUrl(file);
    } catch {
      return;
    }
    setLocalImages((prev) => {
      const copy = prev.slice();
      if (index >= copy.length) copy.push({ src, isNew: true });
      else copy[index] = { src, isNew: true };
      return copy;
    });
  };

  const handleImageRemove = (index) => {
    setLocalImages((prev) => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleDorsalChange = (index, field, value) => {
    setEditedDorsalOptions(prev => {
      const newOpts = [...prev];
      newOpts[index] = { ...newOpts[index], [field]: value };
      return newOpts;
    });
  };

  const handleAddDorsalRow = () => {
    setEditedDorsalOptions(prev => [
      ...prev,
      { name: "", number: "", quantity: "", imageUrl: "" }
    ]);
  };

  const handleRemoveDorsalRow = (index) => {
    setEditedDorsalOptions(prev => {
      if (prev.length <= 1) {
        return [{ name: "", number: "", quantity: "", imageUrl: "" }];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const getInventoryChanges = () => {
    const changes = [];
    const baseTienda = viewProduct?.tienda || product?.tienda || {};
    const baseStock = viewProduct?.stock || product?.stock || {};
    const baseBodega = viewProduct?.bodega || product?.bodega || {};

    tallasVisibles.forEach((size) => {
      const oldTienda = parseInt(baseTienda[size] ?? 0, 10);
      const newTienda = parseInt(editedTienda?.[size] ?? 0, 10);
      if (oldTienda !== newTienda) changes.push(`Tienda [${size}]: ${oldTienda} -> ${newTienda}`);

      const oldStock = parseInt(baseStock[size] ?? 0, 10);
      const newStock = parseInt(editedStock?.[size] ?? 0, 10);
      if (oldStock !== newStock) changes.push(`Bodega 1 [${size}]: ${oldStock} -> ${newStock}`);

      const oldBodega = parseInt(baseBodega[size] ?? 0, 10);
      const newBodega = parseInt(editedBodega?.[size] ?? 0, 10);
      if (oldBodega !== newBodega) changes.push(`Bodega 2 [${size}]: ${oldBodega} -> ${newBodega}`);
    });
    return changes;
  };

  const checkHasDeduction = () => {
    if (isLlavero) return false;

    let decreased = false;
    const baseTienda = viewProduct?.tienda || product?.tienda || {};
    const baseStock = viewProduct?.stock || product?.stock || {};
    const baseBodega = viewProduct?.bodega || product?.bodega || {};

    tallasVisibles.forEach((size) => {
      if (parseInt(baseTienda[size] ?? 0, 10) > parseInt(editedTienda?.[size] ?? 0, 10)) decreased = true;
      if (parseInt(baseStock[size] ?? 0, 10) > parseInt(editedStock?.[size] ?? 0, 10)) decreased = true;
      if (parseInt(baseBodega[size] ?? 0, 10) > parseInt(editedBodega?.[size] ?? 0, 10)) decreased = true;
    });
    return decreased;
  };

  // Cuántas camisetas se están rebajando (sumando Tienda, Bodega 1 y Bodega 2)
  const contarUnidadesRebajadas = () => {
    if (isLlavero) return 0;
    const baseTienda = viewProduct?.tienda || product?.tienda || {};
    const baseStock = viewProduct?.stock || product?.stock || {};
    const baseBodega = viewProduct?.bodega || product?.bodega || {};
    let n = 0;
    tallasVisibles.forEach((size) => {
      [[baseTienda, editedTienda], [baseStock, editedStock], [baseBodega, editedBodega]].forEach(([antes, ahora]) => {
        const d = parseInt(antes[size] ?? 0, 10) - parseInt(ahora?.[size] ?? 0, 10);
        if (d > 0) n += d;
      });
    });
    return n;
  };

  // Filtramos las opciones válidas de dorsal para mostrarlas en el selector de venta
  const validDorsalsForSelect = editedDorsalOptions
    .map((opt, originalIdx) => ({ ...opt, originalIdx }))
    .filter((opt) => (opt.name && opt.name.trim() !== "") || (opt.number && opt.number.trim() !== ""));

  // ¿Alcanzan las impresiones escogidas? (ej. 2 camisetas con FERMÍN #7 y solo queda 1)
  const impresionFaltante = () => {
    const usadas = {};
    purchasedDorsalIdxs.forEach((v) => { if (v !== "") usadas[v] = (usadas[v] || 0) + 1; });
    for (const [idx, n] of Object.entries(usadas)) {
      const opt = editedDorsalOptions[Number(idx)];
      const quedan = Math.max(0, parseInt(opt?.quantity, 10) || 0);
      if (opt && n > quedan) return `Solo ${quedan === 1 ? "queda 1 impresión" : `quedan ${quedan} impresiones`} de ${(opt.name || "JUGADOR").toUpperCase()} #${opt.number}.`;
    }
    return "";
  };

  const handleSave = async (clientName = "", isSale = false) => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) return toast.error("ID de producto inválido");

    try {
      setLoading(true);
      const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)]));
      const cleanTienda = clean(editedTienda);
      const cleanStock = clean(editedStock);
      const cleanBodega = clean(editedBodega);

      const finalCustomer = clientName || (isSale ? "Cliente General / Tienda" : "Ajuste de inventario");
      const clientTag = isSale && finalCustomer ? `👤 Cliente: ${finalCustomer} | ` : "";

      // 👕 Impresiones escogidas (una por camiseta). El backend las rebaja aquí y en el hermano Player/Fan.
      const finalDorsalOptions = editedDorsalOptions.map(opt => ({ ...opt }));
      const purchasedDorsals = editedIsNumerable
        ? purchasedDorsalIdxs
            .filter((v) => v !== "" && finalDorsalOptions[Number(v)])
            .map((v) => ({ name: finalDorsalOptions[Number(v)].name, number: finalDorsalOptions[Number(v)].number }))
        : [];

      const payload = {
        productId: id,
        name: editedName.trim(), 
        price: Math.max(0, parseInt(editedPrice, 10) || 0),
        discountPrice: Math.max(0, parseInt(editedDiscountPrice, 10) || 0), 
        type: editedType.trim(),
        tienda: cleanTienda, 
        stock: cleanStock,   
        bodega: cleanBodega, 
        images: localImages.map((i) => i?.src).filter(Boolean),
        imageSrc: typeof localImages[0]?.src === "string" ? localImages[0].src : null,
        imageSrc2: typeof localImages[1]?.src === "string" ? localImages[1].src : null,
        imageAlt: editedName.trim(), 
        hidden: Boolean(user?.isSuperUser) ? editedHidden : (product?.hidden || false), 
        isMundial2026: editedIsMundial2026,
        isTemporada2627: editedIsTemporada2627, 
        
        isNumerable: editedIsNumerable,
        teamFont: editedIsNumerable ? editedTeamFont : 'barca',
        dorsalOptions: editedIsNumerable ? finalDorsalOptions : [],
        dorsalOptionsBase,
        purchasedDorsals,

        customerName: finalCustomer,
        sellerName: displayName,
        user: displayName,
        isSale: Boolean(isSale),
        details: `${clientTag}[ID:${id}] | ${getInventoryChanges().join(" | ")}`, 
      };
      
      let tiendaModificada = [];
      const tiendaVieja = viewProduct?.tienda || product?.tienda || {};
      const stockViejo = viewProduct?.stock || product?.stock || {};
      const bodegaVieja = viewProduct?.bodega || product?.bodega || {};
      
      if (tallasVisibles.some((size) => parseInt(tiendaVieja[size] ?? 0, 10) !== parseInt(cleanTienda[size] ?? 0, 10))) tiendaModificada.push("Tienda");
      if (tallasVisibles.some((size) => parseInt(stockViejo[size] ?? 0, 10) !== parseInt(cleanStock[size] ?? 0, 10))) tiendaModificada.push("Bodega 1");
      if (tallasVisibles.some((size) => parseInt(bodegaVieja[size] ?? 0, 10) !== parseInt(cleanBodega[size] ?? 0, 10))) tiendaModificada.push("Bodega 2");
      const etiquetaTienda = tiendaModificada.length > 0 ? tiendaModificada.join(" y ") : "";

      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json", "x-user": displayName },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error("La foto es demasiado pesada.");
        throw new Error("Error en el servidor al guardar.");
      }

      const dbUpdatedProduct = await res.json();
      setPurchasedDorsalIdxs([]);
      onSaveSuccess(dbUpdatedProduct);

      if (isSale) {
        toast.success(etiquetaTienda ? `Venta registrada en ${etiquetaTienda}.` : "Venta registrada correctamente.");
      } else {
        toast.success(etiquetaTienda ? `Cambio realizado en ${etiquetaTienda}.` : "Cambios guardados correctamente.");
      }

    } catch (err) {
      console.error("Error al guardar:", err);
      toast.error(err.message === "La foto es demasiado pesada." ? "La foto pesa mucho. Intenta subir una más ligera." : "Error al procesar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) return toast.error("ID inválido");

    try {
      setLoading(true);
      
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE", 
        headers: { "Content-Type": "application/json", "x-user": displayName },
      });

      if (!res.ok) throw new Error("Error en el servidor al eliminar");

      onDeleteSuccess(id);
      toast.success("Producto eliminado correctamente.");

    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("Error al eliminar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start w-full text-black">
        {/* LADO IZQUIERDO: IMÁGENES */}
        <div className="w-full">
          <div className="flex gap-4 justify-center flex-wrap p-8 rounded-3xl border border-gray-200 bg-gray-50 shadow-sm">
            {localImages.map((img, i) => {
              const thumbUrl = img?.src ? transformCloudinary(img.src, THUMB_MAX_W) : "";
              return (
                <div key={i} className="relative group">
                  <img src={thumbUrl || img.src} alt={`img-${i}`} className="h-40 w-40 object-cover rounded-2xl shadow-sm border border-gray-200 bg-white" />
                  <button onClick={() => handleImageRemove(i)} className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-2.5 shadow-lg hover:bg-red-700 cursor-pointer transition-transform hover:scale-105">
                    <FaTimes size={12} />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-white opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-2.5 rounded-b-2xl border-t border-gray-200 backdrop-blur-sm">
                    <label className="text-black text-xs cursor-pointer font-bold tracking-wide uppercase">
                      Cambiar
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
                    </label>
                  </div>
                </div>
              );
            })}
            {localImages.length < 2 && (
              <label className="h-40 w-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-white rounded-2xl cursor-pointer hover:border-black transition-colors group shadow-sm">
                <span className="text-3xl mb-1 text-gray-400 group-hover:text-black transition-colors">+</span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-black transition-colors">Añadir Foto</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, localImages.length)} />
              </label>
            )}
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO */}
        <div className="w-full flex flex-col">
          <div className="mb-8">
            <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Tipo</label>
            <select 
              value={editedType} 
              onChange={(e) => setEditedType(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4 font-semibold outline-none cursor-pointer focus:border-black bg-white text-black transition-colors shadow-sm"
            >
              {["Player", "Fan", "Mujer", "Nacional", "Abrigos", "Retro", "Niño", "F1", "NBA", "MLB", "NFL", "Balón", "Llaveros", "LEGO"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Nombre</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-black outline-none mb-4 focus:border-black bg-white text-black transition-colors shadow-sm placeholder-gray-400" 
              value={editedName} 
              onChange={(e) => setEditedName(e.target.value)} 
              placeholder="Nombre del producto"
            />

            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Precio</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-black bg-white text-black transition-colors shadow-sm" 
                  value={editedPrice} 
                  onChange={(e) => setEditedPrice(e.target.value)} 
                />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-widest ml-1">Descuento</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-black bg-white text-black transition-colors shadow-sm" 
                  value={editedDiscountPrice} 
                  onChange={(e) => setEditedDiscountPrice(e.target.value)} 
                />
              </div>
            </div>
          </div>

          {/* INVENTARIO */}
          <div className="mb-8">
            <div className="rounded-3xl p-6 border border-gray-200 bg-white shadow-sm">
              <p className="text-center font-bold text-black uppercase tracking-widest mb-5 text-xs">Modificando Inventario</p>
              
              <div className="flex gap-2 mb-6">
                <button 
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${invMode === "stock" ? "border-black bg-black text-white shadow-md" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-black hover:text-black"}`} 
                  onClick={() => setInvMode("stock")}
                >
                  <FaBoxOpen size={20} className="mb-1" />
                  <span className="font-black text-[10px] uppercase tracking-wider">Bodega 1</span>
                </button>
                <button 
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${invMode === "bodega" ? "border-black bg-black text-white shadow-md" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-black hover:text-black"}`} 
                  onClick={() => setInvMode("bodega")}
                >
                  <FaWarehouse size={20} className="mb-1" />
                  <span className="font-black text-[10px] uppercase tracking-wider">Bodega 2</span>
                </button>
                <button 
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${invMode === "tienda" ? "border-black bg-black text-white shadow-md" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-black hover:text-black"}`} 
                  onClick={() => setInvMode("tienda")}
                >
                  <FaStore size={20} className="mb-1" />
                  <span className="font-black text-[10px] uppercase tracking-wider">Tienda</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 transition-colors duration-300">
                <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                  {tallasVisibles.map((size) => {
                    const currentVal = invMode === "tienda" ? editedTienda[size] : invMode === "stock" ? editedStock[size] : editedBodega[size];

                    return (
                      <div key={size} className="relative mt-2">
                        <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 px-2 text-[10px] font-black tracking-widest uppercase z-10 bg-black text-white rounded-full">
                          {size}
                        </div>
                        <input 
                          type="number" 
                          min="0" 
                          className={`w-full h-12 pt-1 border border-gray-300 rounded-2xl text-center font-black text-lg bg-white text-black focus:outline-none focus:border-black transition-all ${!currentVal ? 'opacity-70 shadow-sm' : 'shadow-md border-black'}`} 
                          value={currentVal || ""} 
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
          </div>

          <div className="mb-8 p-5 rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
            <p className="text-xs text-black font-bold uppercase tracking-widest mb-4">Opciones del Sistema</p>
            <div className="flex flex-col gap-4">
              
              {Boolean(user?.isSuperUser) && (
                <label className="flex items-center gap-4 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input type="checkbox" checked={editedHidden} onChange={(e) => setEditedHidden(e.target.checked)} className="sr-only" />
                    <div className={`w-11 h-6 rounded-full transition-colors ${editedHidden ? 'bg-black' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedHidden ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-black">Ocultar Producto</span>
                    <span className="text-xs text-gray-500 font-medium">Nadie podrá verlo en la tienda.</span>
                  </div>
                </label>
              )}

              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={editedIsMundial2026} onChange={(e) => setEditedIsMundial2026(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${editedIsMundial2026 ? 'bg-black' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsMundial2026 ? 'transform translate-x-5' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-black">Torneo: Mundial 2026</span>
                  <span className="text-xs text-gray-500 font-medium">Aparecerá en el filtro especial.</span>
                </div>
              </label>

              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={editedIsTemporada2627} onChange={(e) => setEditedIsTemporada2627(e.target.checked)} className="sr-only" />
                  <div className={`w-11 h-6 rounded-full transition-colors ${editedIsTemporada2627 ? 'bg-black' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsTemporada2627 ? 'transform translate-x-5' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-black">Temporada 26-27</span>
                  <span className="text-xs text-gray-500 font-medium">Muestra el sello circular vintage en la chema.</span>
                </div>
              </label>

              {Boolean(user?.isSuperUser) && (
                <label className="flex items-center gap-4 cursor-pointer group border-t border-gray-200 pt-4 mt-2">
                  <div className="relative flex items-center">
                    <input type="checkbox" checked={editedIsNumerable} onChange={(e) => setEditedIsNumerable(e.target.checked)} className="sr-only" />
                    <div className={`w-11 h-6 rounded-full transition-colors ${editedIsNumerable ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${editedIsNumerable ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-blue-700">Habilitar Dorsales</span>
                    <span className="text-xs text-gray-500 font-medium">Permite elegir nombres y números (Rodri 16).</span>
                  </div>
                </label>
              )}

              {Boolean(user?.isSuperUser) && editedIsNumerable && (
                <div className="animate-fade-in-up mt-2">
                  <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-1.5">Tipografía Oficial</label>
                  <select
                    value={editedTeamFont}
                    onChange={(e) => setEditedTeamFont(e.target.value)}
                    className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all cursor-pointer"
                  >
                    <option value="barca">F.C. Barcelona (26/27)</option>
                    <option value="madrid">Real Madrid</option>
                    <option value="boca">Boca Juniors</option>
                    <option value="river">River Plate</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 🔥 CONTENEDOR DE DORSALES CON UN SOLO BOTÓN "+" Y SCROLL HORIZONTAL 🔥 */}
          {Boolean(user?.isSuperUser) && editedIsNumerable && (
            <div className="bg-white border-2 border-blue-100 p-5 rounded-3xl mb-8 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                 <label className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                   Dorsales Disponibles ({editedDorsalOptions.length})
                 </label>
                 <button
                   type="button"
                   onClick={handleAddDorsalRow}
                   className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                 >
                   <FaPlus size={10} /> Agregar Nombre
                 </button>
               </div>

               {/* Contenedor con scroll horizontal (con teclado y mouse) */}
               <div className="max-h-80 overflow-y-auto overflow-x-auto pr-1 pb-2 scrollbar-thin scrollbar-thumb-blue-200" tabIndex={0}>
                 <div className="min-w-[340px] space-y-3">
                   {editedDorsalOptions.map((opt, i) => (
                      <div key={`dorsal-${i}`} className="flex items-center gap-2">
                         <input
                           type="text"
                           placeholder="Jugador (Ej. PEDRI)"
                           value={opt.name}
                           onChange={(e) => handleDorsalChange(i, 'name', e.target.value)}
                           className="w-[46%] min-w-[140px] bg-gray-50 border border-blue-100 rounded-xl px-3 py-3 text-sm font-black text-blue-900 uppercase focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all placeholder-blue-300"
                         />
                         <input
                           type="text"
                           placeholder="N°"
                           value={opt.number}
                           onChange={(e) => handleDorsalChange(i, 'number', e.target.value)}
                           className="w-[22%] min-w-[65px] bg-gray-50 border border-blue-100 rounded-xl px-2 py-3 text-sm font-black text-blue-900 text-center focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all placeholder-blue-300"
                         />
                         <input
                           type="number"
                           min="0"
                           placeholder="Cant."
                           value={opt.quantity}
                           onChange={(e) => handleDorsalChange(i, 'quantity', e.target.value)}
                           title="Cantidad de este dorsal disponible"
                           className="w-[22%] min-w-[65px] bg-gray-50 border border-blue-100 rounded-xl px-2 py-3 text-sm font-black text-blue-900 text-center focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all placeholder-blue-300"
                         />
                         <button
                           type="button"
                           onClick={() => handleRemoveDorsalRow(i)}
                           title="Quitar fila"
                           className="w-[10%] min-w-[36px] h-11 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                         >
                           <FaTimes size={12} />
                         </button>
                      </div>
                   ))}
                 </div>
               </div>

               <p className="text-[10px] text-blue-400 font-medium leading-tight mt-3 text-center">
                 Controla el inventario de las impresiones. Si la cantidad llega a 0, dejará de ofrecerse a los clientes. Usa las flechas del teclado para desplazar si no cabe.
               </p>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3">
            <button
              className="w-full bg-black hover:bg-zinc-800 text-white py-4 sm:py-5 text-sm rounded-2xl font-black tracking-widest uppercase shadow-md transition-transform cursor-pointer"
              onClick={() => {
                const changes = getInventoryChanges();
                
                // Si redujo stock y el producto es numerable, vamos directo a la venta: ahí se escoge
                // la impresión de CADA camiseta rebajada (ver purchasedDorsalIdxs)
                if (checkHasDeduction() && editedIsNumerable && validDorsalsForSelect.length > 0) {
                  setPurchasedDorsalIdxs(Array(contarUnidadesRebajadas()).fill(""));
                  setConfirmCommission(false);
                  setShowBuyerModal(true);
                } else {
                  toastHOT(
                    (t) => (
                      <div className="text-center p-4 rounded-xl border border-gray-200 bg-white shadow-xl">
                        <p className="font-black text-black mb-2 text-base">¿Seguro que quieres guardar estos cambios?</p>
                        {changes.length > 0 ? (
                          <div className="text-left border border-gray-200 bg-gray-50 p-3 rounded-xl mb-4 text-xs font-mono text-gray-600 max-h-32 overflow-y-auto shadow-inner">
                            {changes.map((change, i) => (<div key={i} className="py-1">{change}</div>))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mb-4 font-medium">Se actualizarán los datos generales.</p>
                        )}
                        <div className="flex gap-3 justify-center mt-2">
                          <button 
                            onClick={() => { 
                              toastHOT.dismiss(t.id); 
                              if (checkHasDeduction()) {
                                setPurchasedDorsalIdxs(Array(contarUnidadesRebajadas()).fill(""));
                                setConfirmCommission(false); 
                                setShowBuyerModal(true);
                              } else {
                                handleSave("", false); 
                              }
                            }} 
                            className="bg-black text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-zinc-800 cursor-pointer shadow-sm transition-colors"
                          >
                            SÍ, GUARDAR
                          </button>
                          <button onClick={() => toastHOT.dismiss(t.id)} className="text-black bg-gray-100 px-5 py-2.5 rounded-xl font-bold tracking-wider text-xs hover:bg-gray-200 cursor-pointer border border-gray-200 transition-colors">
                            CANCELAR
                          </button>
                        </div>
                      </div>
                    ), { duration: 8000, style: { background: 'transparent', boxShadow: 'none', padding: 0 } }
                  );
                }
              }}
              disabled={loading}
            >
              {loading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
            </button>
            <button 
              className="w-full bg-white border-2 border-gray-300 text-gray-500 hover:text-black hover:border-black hover:bg-gray-50 py-3 text-xs rounded-2xl font-bold tracking-widest uppercase cursor-pointer transition-colors" 
              onClick={onCancel} 
              disabled={loading}
            >
              CANCELAR EDICIÓN
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 MODAL MULTI-PASO DE VENTA CON SELECTOR DE DORSAL 🔥 */}
      {showBuyerModal && (
        <ModalShell
          size="sm"
          dismissible={false}
          footer={
            !confirmCommission ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const falta = impresionFaltante();
                    if (falta) return toast.error(falta);
                    setShowBuyerModal(false);
                    handleSave(buyerName.trim(), false);
                    setBuyerName("");
                  }}
                  disabled={loading}
                  className="md-btn is-ghost"
                >
                  Solo actualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!buyerName.trim()) {
                      toast.error("Debes ingresar el nombre del cliente para registrar la venta.", { style: { background: '#fff', color: '#000' }});
                      return;
                    }
                    const falta = impresionFaltante();
                    if (falta) return toast.error(falta);
                    setConfirmCommission(true);
                  }}
                  disabled={loading}
                  className="md-btn is-primary"
                >
                  Registrar venta
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmCommission(false)}
                  disabled={loading}
                  className="md-btn is-ghost"
                >
                  No, volver
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBuyerModal(false);
                    setConfirmCommission(false);
                    handleSave(buyerName.trim(), true);
                    setBuyerName("");
                  }}
                  disabled={loading}
                  className="md-btn is-success"
                >
                  Sí, confirmar
                </button>
              </>
            )
          }
        >
          <div className="md-steps" aria-hidden="true">
            <i className="is-on" />
            <i className={confirmCommission ? "is-on" : ""} />
          </div>

          {!confirmCommission ? (
            <>
              <div className="md-center">
                <span className="md-big-icon"><FaUser /></span>
                <span className="md-eyebrow">Venta · Paso 1 de 2</span>
                <h3 className="md-title">¿Quién compró?</h3>
                <p className="md-subtitle">Rebajaste existencias del inventario. Ingresá el nombre del cliente para dejarlo registrado.</p>
              </div>

              <label className="md-field">
                <span className="md-label">Nombre del cliente</span>
                <input
                  type="text"
                  placeholder="Ej: Emanuel Espinoza"
                  className="md-input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && buyerName.trim()) setConfirmCommission(true); }}
                  autoFocus
                />
              </label>

              {/* 👕 IMPRESIÓN POR CAMISETA (solo si el producto es numerable) */}
              {editedIsNumerable && validDorsalsForSelect.length > 0 && purchasedDorsalIdxs.length > 0 && (
                <div className="md-section is-blue">
                  <span className="md-section-title">
                    <FaTshirt /> {purchasedDorsalIdxs.length > 1 ? `Impresión de cada camiseta (${purchasedDorsalIdxs.length})` : "Dorsal vendido"}
                  </span>
                  {purchasedDorsalIdxs.map((valor, n) => (
                    <label key={`sale-dorsal-${n}`} className="md-field">
                      {purchasedDorsalIdxs.length > 1 && <span className="md-label">Camiseta {n + 1}</span>}
                      <select
                        value={valor}
                        onChange={(e) => setPurchasedDorsalIdxs((arr) => arr.map((v, k) => (k === n ? e.target.value : v)))}
                        className="md-input"
                      >
                        <option value="">Sin dorsal (camiseta lisa)</option>
                        {validDorsalsForSelect.map((opt) => (
                          <option key={`sale-dorsal-${n}-${opt.originalIdx}`} value={opt.originalIdx}>
                            {opt.name ? opt.name.toUpperCase() : "JUGADOR"} — #{opt.number} (Quedan: {opt.quantity || 0})
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <p className="md-hint">Se rebaja de las impresiones de la Player y la Fan a la vez. Si se anula la venta, se devuelven.</p>
                </div>
              )}
            </>
          ) : (
            <div className="md-center">
              <span className="md-big-icon is-green"><FaCheck /></span>
              <span className="md-eyebrow">Venta · Paso 2 de 2</span>
              <h3 className="md-title">Confirmar comisión</h3>
              <p className="md-subtitle">
                ¿Seguro que hiciste una venta o un cambio{buyerName.trim() ? <> a <b style={{ color: "#000" }}>{buyerName.trim()}</b></> : null}?
              </p>
            </div>
          )}
        </ModalShell>
      )}
    </>
  );
}