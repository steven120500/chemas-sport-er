import { useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { FaWhatsapp, FaTimes } from 'react-icons/fa';
import { toast as toastHOT } from 'react-hot-toast';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const API_BASE = 'https://chemas-sport-er-backend.onrender.com';

const TALLAS_ADULTO = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const TALLAS_NINO   = ['16', '18', '20', '22', '24', '26', '28'];
const ACCEPTED_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/heic'];

/* ---------- SOLO PARA AHORRAR ANCHO DE BANDA ---------- */
const MODAL_IMG_MAX_W = 800; // ancho tope para la imagen grande del modal
const THUMB_MAX_W     = 240; // ancho tope para miniaturas en modo edición

function transformCloudinary(url, maxW) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('res.cloudinary.com')) return url;
    const parts = u.pathname.split('/upload/');
    if (parts.length < 2) return url;
    const transforms = `f_auto,q_auto:eco,c_limit,w_${maxW},dpr_auto`;
    u.pathname = `${parts[0]}/upload/${transforms}/${parts[1]}`;
    return u.toString();
  } catch {
    return url;
  }
}
/* ------------------------------------------------------ */

function isLikelyObjectId(v) {
  return typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
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

  // -------- Estado base / edición --------
  const [viewProduct, setViewProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(false);

  // 🆕 modo de inventario: 'stock' o 'bodega'
  const [invMode, setInvMode] = useState('stock');

  const [editedStock,  setEditedStock]  = useState(product.stock  || {});
  const [editedBodega, setEditedBodega] = useState(product.bodega || {}); 
  const [editedName,   setEditedName]   = useState(product?.name || '');
  const [editedPrice,  setEditedPrice]  = useState(product?.price ?? 0);
  const [editedDiscountPrice, setEditedDiscountPrice] = useState(product?.discountPrice ?? 0); // 🟡 nuevo
  const [editedType,   setEditedType]   = useState(product?.type || 'Player');
  const [loading,      setLoading]      = useState(false);

  // -------- Galería preferente (product.images) --------
  const galleryFromProduct = useMemo(() => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images
        .map(i => (typeof i === 'string' ? i : i?.url))
        .filter(Boolean);
    }
    return [product?.imageSrc, product?.imageSrc2].filter(Boolean);
  }, [product]);

  const [localImages, setLocalImages] = useState(
    galleryFromProduct.map(src => ({ src, isNew: false }))
  );

  const [idx, setIdx] = useState(0);
  const hasMany = localImages.length > 1;
  const currentSrc = localImages[idx]?.src || '';

  // Sincroniza cuando cambie el product desde afuera
  useEffect(() => {
    setViewProduct(product);
    setEditedName(product?.name || '');
    setEditedPrice(product?.price ?? 0);
    setEditedDiscountPrice(product?.discountPrice ?? 0); // 🟡 nuevo
    setEditedType(product?.type || 'Player');
    setEditedStock({ ...(product?.stock  || {}) });
    setEditedBodega({ ...(product?.bodega || {}) }); 
    setLocalImages(
      product?.images?.length
        ? product.images.map(img => ({ src: typeof img === 'string' ? img : img.url, isNew: false }))
        : [
            ...(product?.imageSrc  ? [{ src: product.imageSrc,  isNew: false }] : []),
            ...(product?.imageSrc2 ? [{ src: product.imageSrc2, isNew: false }] : []),
          ]
    );
    setIdx(0);
  }, [product]);

  // bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // -------- Acciones --------
  const handleSave = async () => {
    if (loading) return;

    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) {
      toast.error('No se encontró un ID válido del producto');
      return;
    }

    try {
      setLoading(true);
      const displayName = user?.username || user?.email || 'ChemaSportER';

      const priceInt = Math.max(0, parseInt(editedPrice, 10) || 0);
      const discountInt = Math.max(0, parseInt(editedDiscountPrice, 10) || 0); // 🟡 nuevo
      const clean = (obj) =>
        Object.fromEntries(
          Object.entries(obj || {}).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)])
        );

      const payload = {
        name: (editedName || '').trim(),
        price: priceInt,
        discountPrice: discountInt, // 🟡 nuevo
        type: (editedType || '').trim(),
        stock:  clean(editedStock),
        bodega: clean(editedBodega),

        images: localImages.map(i => i?.src).filter(Boolean),
        imageSrc:  typeof localImages[0]?.src === 'string' ? localImages[0].src : null,
        imageSrc2: typeof localImages[1]?.src === 'string' ? localImages[1].src : null,
        imageAlt: (editedName || '').trim(),
      };

      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user': displayName,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Error al actualizar (${res.status})`);

      const updated = await res.json();

      setViewProduct(updated);
      setEditedName(updated.name || '');
      setEditedPrice(updated.price ?? 0);
      setEditedDiscountPrice(updated.discountPrice ?? 0); // 🟡 nuevo
      setEditedType(updated.type || 'Player');
      setEditedStock({ ...(updated.stock  || {}) });
      setEditedBodega({ ...(updated.bodega || {}) });
      setLocalImages(
        updated?.images?.length
          ? updated.images.map(img => ({ src: typeof img === 'string' ? img : img.url, isNew: false }))
          : [
              ...(updated?.imageSrc  ? [{ src: updated.imageSrc,  isNew: false }] : []),
              ...(updated?.imageSrc2 ? [{ src: updated.imageSrc2, isNew: false }] : []),
            ]
      );
      setIdx(0);

      onUpdate?.(updated);
      setIsEditing(false);
      
    } catch (err) {
      console.error(err);
      toast.error('Hubo un problema al actualizar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (loading) return;
    const id = product?._id || product?.id;
    if (!id || !isLikelyObjectId(id)) {
      toast.error('No se encontró un ID válido del producto');
      return;
    }
    try {
      setLoading(true);
      const displayName = user?.username || user?.email || 'ChemaSportER';
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user': displayName },
      });
      if (!res.ok) throw new Error('Error al eliminar');
      onUpdate?.(null, id);
      onClose?.();
    } catch (err) {
      toast.error('No se pudo eliminar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (size, value) => {
    if (invMode === 'stock') {
      setEditedStock(prev => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
    } else {
      setEditedBodega(prev => ({ ...prev, [size]: parseInt(value, 10) || 0 }));
    }
  };

  const handleImageChange = (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato de imagen no soportado');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLocalImages(prev => {
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
    setLocalImages(prev => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
    setIdx(0);
  };

  // Tallas visibles
  const isNino = (isEditing ? editedType : viewProduct?.type) === 'Niño';
  const tallasVisibles = isNino ? TALLAS_NINO : TALLAS_ADULTO;

  // URL optimizada SOLO para mostrar en modal
  const displayUrl = currentSrc ? transformCloudinary(currentSrc, MODAL_IMG_MAX_W) : '';

  const getInventoryToShow = () => {
    if (isEditing) return invMode === 'stock' ? editedStock : editedBodega;
    return invMode === 'stock' ? (viewProduct?.stock || {}) : (viewProduct?.bodega || {});
  };

  const hasDiscount = viewProduct?.discountPrice && Number(viewProduct.discountPrice) > 0; // 🟡 nuevo

  return (
    <div className="mt-10 mb-16 fixed inset-0 z-50 bg-black/40 flex items-center justify-center py-6">
      <div
        ref={modalRef}
        className="relative bg-white pt-15 p-6 rounded-lg shadow-md max-w-md w-full max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400"
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute mr-2 top-12 right-2 text-white bg-black rounded p-1"
          title="Cerrar"
        >
          <FaTimes size={30} />
        </button>

        {/* Encabezado */}
        <div className="mt-16 mb-2 text-center">
          {isEditing && canEdit ? (
            <>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={editedType}
                onChange={(e) => setEditedType(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-3"
              >
                {['Player','Fan','Mujer','Nacional','Abrigos','Retro','Niño','F1','NBA','MLB','NFL'].map(t => (
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

              <label className="block text-xs text-gray-500 mb-1 mt-4">Precio normal</label>
              <input
                type="number"
                className="text-center border-b-2 w-full font-semibold text-2xl"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
              />

              <label className="block text-xs text-gray-500 mb-1 mt-4">Precio con descuento</label>
              <input
                type="number"
                className="text-center border-b-2 w-full font-semibold text-2xl text-green-600"
                value={editedDiscountPrice}
                onChange={(e) => setEditedDiscountPrice(e.target.value)}
              />
            </>
          ) : (
            <>
              <span className="block text-xs uppercase tracking-wide text-gray-500 font-semibold">
                {viewProduct?.type}
              </span>
              <h2 className="text-xl font-extrabold font-sans ">{viewProduct?.name}</h2>
            </>
          )}
        </div>

        {/* Galería */}
        {!isEditing ? (
          <div className="relative mb-4 flex items-center justify-center">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={viewProduct?.imageAlt || viewProduct?.name || 'Producto'}
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
                  onClick={() => setIdx(i => (i - 1 + localImages.length) % localImages.length)}
                  className="absolute left-0 z-10 bg-black text-white  px-3 py-1 rounded-full shadow-md text-l"
                >
                  <FaChevronLeft/>
                </button>
                <button
                  onClick={() => setIdx(i => (i + 1) % localImages.length)}
                  className="absolute right-0 z-10 bg-black text-white px-3 py-1 rounded-full shadow-md text-l"
                >
                  <FaChevronRight/>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-4 justify-center flex-wrap mb-4">
            {localImages.map((img, i) => {
              const thumbUrl = img?.src ? transformCloudinary(img.src, THUMB_MAX_W) : '';
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
                  <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, i)} />
                </div>
              );
            })}
            {localImages.length < 2 && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e, localImages.length)}
              />
            )}
          </div>
        )}

        {/* 💰 Precio */}
        {!isEditing && (
          <div className="mt-2 text-center">
            {hasDiscount ? (
              <>
                <p className="text-sm sm:text-base line-through text-gray-400">
                  ₡{Number(viewProduct.price).toLocaleString('de-DE')}
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-green-600">
                  ₡{Number(viewProduct.discountPrice).toLocaleString('de-DE')}
                </p>
              </>
            ) : (
              <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-black">
                ₡{Number(viewProduct.price).toLocaleString('de-DE')}
              </p>
            )}
          </div>
        )}

        {/* 🆕 Selector Stock / Bodega */}
        {canEdit && (
          <div className="mt-4 mb-2 flex items-center justify-center gap-2">
            <button
              className={`px-3 py-1 rounded border text-sm ${invMode === 'stock' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
              onClick={() => setInvMode('stock')}
              type="button"
            >
              Stock
            </button>
            <button
              className={`px-3 py-1 rounded border text-sm ${invMode === 'bodega' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
              onClick={() => setInvMode('bodega')}
              type="button"
            >
              Bodega
            </button>
          </div>
        )}

        {/* Tallas */}
        <div className="mb-0">
          <p className="text-center font-semibold mb-6">
            {invMode === 'stock' ? 'Stock por talla:' : 'Bodega por talla:'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {tallasVisibles.map((talla) => {
              const inv = getInventoryToShow();
              return (
                <div key={talla} className="text-center border rounded p-2">
                  <label className="block text-sm font-medium">{talla}</label>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-gray-300 rounded px-1 text-center"
                      value={inv[talla] === 0 ? '' : (inv[talla] ?? '')}
                      onChange={(e) => handleStockChange(talla, e.target.value)}
                    />
                  ) : (
                    <p className="text-xs">{inv[talla] || 0} disponibles</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-2 border-t pt-4">
          <div className="mb-10 grid grid-cols-2 gap-2 w-full max-w-xs mx-auto">
            {canEdit && isEditing ? (
              <button
                className="col-span-2 bg-green-600 text-black px-3 py-2 text-sm rounded hover:bg-green-500 transition font-bold"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            ) : canEdit ? (
              <button
                className="bg-green-700 text-white px-3 py-2 text-sm rounded hover:bg-gray-800 transition font-bold"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
            ) : null}

            {canDelete && (
              <button
                className="bg-red-600 text-white px-3 py-2 text-sm rounded hover:bg-red-700 transition font-bold"
                onClick={() => {
                  toastHOT((t) => (
                    <span>
                      ¿Seguro que quieres eliminar?
                      <div className="mt-2 flex gap-2 justify-end">
                        <button
                          onClick={() => { toastHOT.dismiss(t.id); handleDelete(); }}
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
                  ), { duration: 6000 });
                }}
                disabled={loading}
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
