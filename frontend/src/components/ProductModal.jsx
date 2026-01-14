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
  isOpen, // ✅ ÚNICO CAMBIO: Recibimos la prop para animar
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

  // ⭐ NUEVO: estado para ocultar
  const [editedHidden, setEditedHidden] = useState(product?.hidden || false);

  // Galería
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

    // 🔥 sincronizar hidden cuando cambie el producto
    setEditedHidden(product?.hidden || false);

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

  // Guardar cambios
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

        // ⭐ AQUÍ SE ENVÍA EL OCULTO AL BACKEND
        hidden: editedHidden,
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

  // Eliminar producto
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

  // Determinar tipo de tallas
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
    // ✅ MANTENEMOS TUS CLASES EXACTAS (mt-10 mb-16 py-6) Y SOLO AGREGAMOS LA TRANSICIÓN DE FONDO
    <div 
        className={`mt-10 mb-16 fixed inset-0 z-50 flex items-center justify-center py-6 transition-colors duration-300 ${
            isOpen ? "bg-black/40 visible" : "bg-black/0 invisible"
        }`}
        onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()} 
        // ✅ MANTENEMOS TUS CLASES DE SCROLL (max-h-screen, overflow-y-auto) Y SOLO AGREGAMOS SCALE/OPACITY
        className={`relative bg-white p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 transition-all duration-300 transform ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-2 bg-black text-white rounded p-1"
          title="Cerrar"
        >
          <FaTimes size={30} />
        </button>

        {/* Encabezado */}
        <div className="mt-12 mb-2 text-center">
          {isEditing && canEdit ? (
            <>
              <label className="block text-xs text-gray-500 mb-1">
                Tipo
              </label>
              <select
                value={editedType}
                onChange={(e) => setEditedType(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-3"
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

              <label className="block text-xs text-gray-500 mb-1">
                Nombre
              </label>
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
                onChange={(e) =>
                  setEditedDiscountPrice(e.target.value)
                }
              />
            </>
          ) : (
            <>
              <span className="block text-xs uppercase tracking-wide text-gray-500 font-semibold">
                {viewProduct?.type}
              </span>
              <h2 className="text-xl font-extrabold">
                {viewProduct?.name}
              </h2>
            </>
          )}
        </div>

        {/* Galería */}
        {!isEditing ? (
          <div className="relative mb-4 flex items-center justify-center">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={viewProduct?.name || "Producto"}
                className="rounded-lg max-h-[400px] object-contain"
                loading="lazy"
              />
            ) : (
              <div className="h-[300px] w-full grid place-items-center text-gray-400">
                Sin imagen
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
                  className="absolute left-0 z-10 bg-black text-white px-3 py-1 rounded-full"
                >
                  <FaChevronLeft />
                </button>
                <button
                  onClick={() =>
                    setIdx(
                      (i) =>
                        (i + 1) % localImages.length
                    )
                  }
                  className="absolute right-0 z-10 bg-black text-white px-3 py-1 rounded-full"
                >
                  <FaChevronRight />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            {localImages.map((img, i) => {
              const thumbUrl = img?.src
                ? transformCloudinary(img.src, THUMB_MAX_W)
                : "";
              return (
                <div key={i} className="relative">
                  <img
                    src={thumbUrl || img.src}
                    alt={`img-${i}`}
                    className="h-48 rounded object-contain"
                    loading="lazy"
                  />
                  <button
                    onClick={() => handleImageRemove(i)}
                    className="absolute top-0 right-0 bg-black text-white rounded-full p-1 text-sm"
                    title="Quitar"
                  >
                    <FaTimes />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleImageChange(e, i)
                    }
                  />
                </div>
              );
            })}
            {localImages.length < 2 && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleImageChange(e, localImages.length)
                }
              />
            )}
          </div>
        )}

        {/* Precio */}
        {!isEditing && (
          <div className="mt-2 text-center">
            {hasDiscount ? (
              <>
                <p className="line-through text-gray-400">
                  ₡{Number(viewProduct.price).toLocaleString("de-DE")}
                </p>
                <p className="text-xl font-extrabold text-green-600">
                  ₡{Number(viewProduct.discountPrice).toLocaleString(
                    "de-DE"
                  )}
                </p>
              </>
            ) : (
              <p className="text-xl font-extrabold text-black">
                ₡{Number(viewProduct.price).toLocaleString("de-DE")}
              </p>
            )}
          </div>
        )}

        {/* Selector de tienda */}
        {canEdit && (
          <div className="mt-4 mb-2 flex items-center justify-center gap-2">
            <button
              className={`px-3 py-1 rounded border text-sm ${
                invMode === "stock" ? "bg-black text-white" : ""
              }`}
              onClick={() => setInvMode("stock")}
            >
              Tienda #1
            </button>
            <button
              className={`px-3 py-1 rounded border text-sm ${
                invMode === "bodega" ? "bg-black text-white" : ""
              }`}
              onClick={() => setInvMode("bodega")}
            >
              Tienda #2
            </button>
          </div>
        )}

        {/* Tallas */}
        <div className="mb-4">
          <p className="text-center font-semibold mb-4">
            Stock por talla:
          </p>
          <div className="grid grid-cols-3 gap-2">
            {tallasVisibles.map((size) => {
              if (canEdit) {
                const inv = getInventoryToShow();
                return (
                  <div
                    key={size}
                    className="text-center bg-white border rounded p-2"
                  >
                    <label className="block text-sm font-medium">
                      {size}
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded px-1 text-center"
                        value={inv[size] ?? ""}
                        onChange={(e) =>
                          handleStockChange(size, e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-xs">
                        {inv[size] || 0} disponibles
                      </p>
                    )}
                  </div>
                );
              } else {
                const total = getTotalBySize(size);
                return (
                  <div
                    key={size}
                    className="text-center bg-white border rounded p-2"
                  >
                    <label className="block text-sm font-medium">
                      {size}
                    </label>
                    <p className="text-xs">{total} disponibles</p>
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* ⭐ CHECKBOX OCULTAR PRODUCTO */}
        {canEdit && isEditing && (
          <div className="mt-4 mb-4 flex items-center gap-3 p-3 bg-gray-100 rounded-lg border">
            <input
              type="checkbox"
              checked={editedHidden}
              onChange={(e) => setEditedHidden(e.target.checked)}
            />
            <label className="text-sm font-semibold">
              Ocultar este producto para los clientes
            </label>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-2 border-t pt-4">
          <div className="mb-10 grid grid-cols-2 gap-2 w-full max-w-xs mx-auto">
            {canEdit && isEditing ? (
              <button
                className="col-span-2 bg-green-600 text-black px-3 py-2 text-sm rounded font-bold"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            ) : canEdit ? (
              <button
                className="bg-green-700 text-white px-3 py-2 text-sm rounded font-bold"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
            ) : null}

            {canDelete && (
              <button
                className="bg-red-600 text-white px-3 py-2 text-sm rounded font-bold"
                onClick={() => {
                  toastHOT(
                    (t) => (
                      <span>
                        ¿Seguro que quieres eliminar?
                        <div className="mt-2 flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              toastHOT.dismiss(t.id);
                              handleDelete();
                            }}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => toastHOT.dismiss(t.id)}
                            className="bg-gray-200 px-3 py-1 rounded text-sm"
                          >
                            No
                          </button>
                        </div>
                      </span>
                    ),
                    { duration: 6000 }
                  );
                }}
                disabled={loading}
              >
                {loading ? "Eliminando..." : "Eliminar"}
              </button>
            )}

            <button
              className="bg-black text-white px-3 py-2 text-sm rounded font-bold col-span-2 mt-2"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}