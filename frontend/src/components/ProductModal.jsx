import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
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


  // NUEVO: ocultar producto
  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);


  const [editedStock, setEditedStock] = useState(product.stock || {});
  const [editedBodega, setEditedBodega] = useState(product.bodega || {});
  const [editedName, setEditedName] = useState(product?.name || "");
  const [editedPrice, setEditedPrice] = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(product?.discountPrice ?? 0);
  const [editedType, setEditedType] = useState(product?.type || "Player");


  const [loading, setLoading] = useState(false);


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


    setLocalImages(
      product?.images?.length
        ? product.images.map((img) => ({
            src: typeof img === "string" ? img : img.url,
            isNew: false,
          }))
        : [
            ...(product?.imageSrc ? [{ src: product.imageSrc, isNew: false }] : []),
            ...(product?.imageSrc2 ? [{ src: product.imageSrc2, isNew: false }] : []),
          ]
    );
    setIdx(0);
  }, [product]);


  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "auto");
  }, []);


  // ===========================
  // GUARDAR CAMBIOS
  // ===========================
  const handleSave = async () => {
    if (loading) return;


    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) {
      toast.error("ID inválido");
      return;
    }


    try {
      setLoading(true);


      const displayName = user?.username || user?.email || "ChemaSportER";


      const payload = {
        name: editedName.trim(),
        price: Math.max(0, parseInt(editedPrice, 10) || 0),
        discountPrice: Math.max(0, parseInt(editedDiscountPrice, 10) || 0),
        type: editedType.trim(),
        stock: editedStock,
        bodega: editedBodega,
        images: localImages.map((i) => i?.src).filter(Boolean),
        imageSrc: typeof localImages[0]?.src === "string" ? localImages[0].src : null,


        hidden: editedHidden, // ← NUEVO
      };


      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user": displayName,
          "x-admin": canEdit || user?.isSuperUser ? "true" : "false", // ← CLAVE
        },
        body: JSON.stringify(payload),
      });


      if (!res.ok) throw new Error("Error al actualizar");


      const updated = await res.json();
      onUpdate?.(updated);
      setIsEditing(false);
    } catch (err) {
      toast.error("Error al actualizar el producto");
    } finally {
      setLoading(false);
    }
  };


  // ===========================
  // ELIMINAR
  // ===========================
  const handleDelete = async () => {
    if (loading) return;


    const id = product?._id || product?.id;


    try {
      setLoading(true);
      const displayName = user?.username || user?.email || "ChemaSportER";


      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user": displayName,
          "x-admin": canDelete || user?.isSuperUser ? "true" : "false",
        },
      });


      if (!res.ok) throw new Error("Error al eliminar");


      onUpdate?.(null, id);
      onClose();
    } catch (err) {
      toast.error("No se pudo eliminar");
    } finally {
      setLoading(false);
    }
  };


  const isNino = (isEditing ? editedType : viewProduct?.type) === "Niño";
  const isBalon =
    (isEditing ? editedType : viewProduct?.type) === "Balón" ||
    (isEditing ? editedType : viewProduct?.type) === "Balones";


  const tallasVisibles = isBalon
    ? TALLAS_BALON
    : isNino
    ? TALLAS_NINO
    : TALLAS_ADULTO;


  const displayUrl = currentSrc ? transformCloudinary(currentSrc, MODAL_IMG_MAX_W) : "";


  const getInventoryToShow = () =>
    isEditing ? (invMode === "stock" ? editedStock : editedBodega) : invMode === "stock"
    ? viewProduct?.stock || {}
    : viewProduct?.bodega || {};


  const hasDiscount = Number(product.discountPrice) > 0;


  const getTotalBySize = (size) =>
    (viewProduct?.stock?.[size] ?? 0) + (viewProduct?.bodega?.[size] ?? 0);


  // ===========================
  // UI PRINCIPAL DEL MODAL
  // ===========================
  return (
    <div className="mt-10 mb-16 fixed inset-0 z-50 bg-black/40 flex items-center justify-center py-6">
      <div
        ref={modalRef}
        className="relative bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
      >
        {/* CERRAR */}
        <button
          onClick={onClose}
          className="absolute top-6 right-2 bg-black text-white rounded p-1"
        >
          <FaTimes size={30} />
        </button>


        {/* ENCABEZADO */}
        <div className="mt-12 mb-2 text-center">
          {isEditing && canEdit ? (
            <>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={editedType}
                onChange={(e) => setEditedType(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-3"
              >
                {[
                  "Player", "Fan", "Mujer", "Nacional", "Abrigos", "Retro",
                  "Niño", "F1", "NBA", "MLB", "NFL", "Balón"
                ].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>


              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input
                type="text"
                className="text-center border-b-2 w-full font-semibold"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />


              <label className="block text-xs text-gray-500 mb-1 mt-4">
                Precio normal
              </label>
              <input
                type="number"
                className="text-center border-b-2 w-full font-semibold text-2xl"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
              />


              <label className="block text-xs text-gray-500 mb-1 mt-4">
                Precio con descuento
              </label>
              <input
                type="number"
                className="text-center border-b-2 w-full font-semibold text-2xl text-green-600"
                value={editedDiscountPrice}
                onChange={(e) => setEditedDiscountPrice(e.target.value)}
              />


              {/* CHECKBOX OCULTAR */}
              <label className="flex items-center gap-2 mt-4 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={editedHidden}
                  onChange={(e) => setEditedHidden(e.target.checked)}
                />
                Ocultar este producto
              </label>
            </>
          ) : (
            <>
              <span className="block text-xs uppercase text-gray-500 font-semibold">
                {viewProduct?.type}
              </span>
              <h2 className="text-xl font-extrabold">{viewProduct?.name}</h2>
            </>
          )}
        </div>


        {/* IMAGEN */}
        {!isEditing ? (
          <div className="relative mb-4 flex items-center justify-center">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={viewProduct?.name}
                className="rounded-lg max-h-[400px] object-contain"
              />
            ) : (
              <div className="h-[300px] grid place-items-center text-gray-400">
                Sin imagen
              </div>
            )}


            {hasMany && (
              <>
                <button
                  onClick={() =>
                    setIdx((i) => (i - 1 + localImages.length) % localImages.length)
                  }
                  className="absolute left-0 bg-black text-white px-3 py-1 rounded-full"
                >
                  <FaChevronLeft />
                </button>


                <button
                  onClick={() => setIdx((i) => (i + 1) % localImages.length)}
                  className="absolute right-0 bg-black text-white px-3 py-1 rounded-full"
                >
                  <FaChevronRight />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            {localImages.map((img, i) => {
              const thumb = img?.src ? transformCloudinary(img.src, THUMB_MAX_W) : "";
              return (
                <div key={i} className="relative">
                  <img
                    src={thumb || img.src}
                    alt=""
                    className="h-48 rounded object-contain"
                  />
                  <button
                    onClick={() =>
                      setLocalImages((prev) => prev.filter((_, x) => x !== i))
                    }
                    className="absolute top-0 right-0 bg-black text-white rounded-full p-1 text-sm"
                  >
                    <FaTimes />
                  </button>
                </div>
              );
            })}


            {localImages.length < 2 && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setLocalImages([
                    ...localImages,
                    { src: URL.createObjectURL(e.target.files[0]), isNew: true },
                  ])
                }
              />
            )}
          </div>
        )}


        {/* PRECIO */}
        {!isEditing && (
          <div className="mt-2 text-center">
            {hasDiscount ? (
              <>
                <p className="line-through text-gray-400">
                  ₡{Number(viewProduct.price).toLocaleString("de-DE")}
                </p>
                <p className="text-xl font-extrabold text-green-600">
                  ₡{Number(viewProduct.discountPrice).toLocaleString("de-DE")}
                </p>
              </>
            ) : (
              <p className="text-xl font-extrabold">
                ₡{Number(viewProduct.price).toLocaleString("de-DE")}
              </p>
            )}
          </div>
        )}


        {/* SELECTOR TIENDA */}
        {canEdit && (
          <div className="mt-4 mb-2 flex justify-center gap-2">
            <button
              className={`px-3 py-1 border rounded ${
                invMode === "stock" ? "bg-black text-white" : ""
              }`}
              onClick={() => setInvMode("stock")}
            >
              Tienda #1
            </button>


            <button
              className={`px-3 py-1 border rounded ${
                invMode === "bodega" ? "bg-black text-white" : ""
              }`}
              onClick={() => setInvMode("bodega")}
            >
              Tienda #2
            </button>
          </div>
        )}


        {/* INVENTARIO */}
        <div className="mb-4">
          <p className="text-center font-semibold mb-4">Stock por talla:</p>
          <div className="grid grid-cols-3 gap-2">
            {tallasVisibles.map((t) => {
              const inv = getInventoryToShow();
              return (
                <div key={t} className="text-center border rounded p-2">
                  <label className="block font-medium text-sm">{t}</label>


                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      className="w-full text-center border rounded"
                      value={inv[t] ?? ""}
                      onChange={(e) =>
                        invMode === "stock"
                          ? setEditedStock((p) => ({
                              ...p,
                              [t]: parseInt(e.target.value, 10) || 0,
                            }))
                          : setEditedBodega((p) => ({
                              ...p,
                              [t]: parseInt(e.target.value, 10) || 0,
                            }))
                      }
                    />
                  ) : (
                    <p className="text-xs">
                      {getTotalBySize(t)} disponibles
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>


        {/* ACCIONES */}
        <div className="mt-4 border-t pt-4">
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {canEdit && isEditing ? (
              <button
                onClick={handleSave}
                disabled={loading}
                className="col-span-2 bg-green-600 text-black py-2 rounded font-bold"
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            ) : canEdit ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-green-700 text-white py-2 rounded font-bold"
              >
                Editar
              </button>
            ) : null}


            {canDelete && (
              <button
                onClick={() =>
                  toastHOT((t) => (
                    <span>
                      ¿Seguro que deseas eliminar?
                      <div className="flex gap-2 mt-2 justify-end">
                        <button
                          onClick={() => {
                            toastHOT.dismiss(t.id);
                            handleDelete();
                          }}
                          className="bg-red-600 text-white px-3 py-1 rounded"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => toastHOT.dismiss(t.id)}
                          className="bg-gray-300 px-3 py-1 rounded"
                        >
                          No
                        </button>
                      </div>
                    </span>
                  ))
                }
                className="bg-red-600 text-white py-2 rounded font-bold"
              >
                Eliminar
              </button>
            )}


            <button
              onClick={onClose}
              className="col-span-2 bg-black text-white py-2 rounded font-bold mt-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
