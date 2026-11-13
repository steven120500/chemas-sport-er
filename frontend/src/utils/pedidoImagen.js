// utils/pedidoImagen.js
// 🧾 Imagen del pedido "como en el Excel" para que el cliente verifique (reemplaza la captura que hacía Johanna).
// Mismas columnas que la hoja del proveedor. Se dibuja en un <canvas> (sin librerías) y se comparte / copia / descarga.
// Igual que la hoja de Johanna:
//   · manga larga → "M LONG SLEEVE" con la talla en amarillo
//   · Fan con nombre/número → número y nombre en amarillo
//   · parche: foto (si tiene) y/o texto; sin nada → N/A
// Pagado = adelanto + abonos.
import { pagadoDe, saldoDe } from "./pedidosPago";

const COLS = [
  { key: "img", label: "Image", w: 150 },
  { key: "equipo", label: "Team", w: 300 },
  { key: "talla", label: "Size", w: 130 },
  { key: "version", label: "Versión", w: 110 },
  { key: "dorsal", label: "Number", w: 100 },
  { key: "nombre", label: "Name", w: 150 },
  { key: "parche", label: "Patches", w: 230 },
  { key: "cantidad", label: "Quantity", w: 100 },
  { key: "cliente", label: "Client", w: 200 },
];
const ANCHO = COLS.reduce((a, c) => a + c.w, 0); // 1470
const PAD = 24;
const ALTO_FILA = 170;
const ALTO_HEAD = 46;
const FONT = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

const colones = (n) => `₡${Number(n || 0).toLocaleString("de-DE")}`;
const sinParche = (p) => !p || /^(n\/?a|none|no|sin parche)$/i.test(p);

export const tallaHoja = (it) => (it?.manga === "Larga" ? `${it.talla} LONG SLEEVE` : it?.talla || "");
export const resaltarDorsal = (it) => /fan/i.test(it?.version || "") && Boolean(it?.nombre || it?.dorsal);
const AMARILLO = "#FFFF00";

// Foto chica de Cloudinary (nunca el original, ver CLAUDE.md)
const fotoCanvas = (url, t = "c_fill,w_260,h_300") =>
  url && url.includes("res.cloudinary.com") && url.includes("/upload/")
    ? url.replace("/upload/", `/upload/f_jpg,q_auto:eco,${t}/`)
    : url;

/** Dibuja la imagen completa dentro del cuadro (sin recortar), centrada */
function dibujarContenida(ctx, img, x, y, w, h) {
  const r = Math.min(w / img.width, h / img.height);
  const dw = img.width * r, dh = img.height * r;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function cargarImagen(url, t) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = fotoCanvas(url, t);
  });
}

/** Parte un texto en líneas que quepan en `max` px (máx. `lineas` líneas, con "…") */
function partir(ctx, texto, max, lineas = 4) {
  const palabras = String(texto ?? "").split(/\s+/).filter(Boolean);
  const out = [];
  let linea = "";
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width <= max) linea = prueba;
    else {
      if (linea) out.push(linea);
      linea = p;
    }
  }
  if (linea) out.push(linea);
  if (out.length > lineas) {
    out.length = lineas;
    out[lineas - 1] = `${out[lineas - 1].replace(/.{0,2}$/, "")}…`;
  }
  return out;
}

/** Genera el PNG del pedido. Devuelve un Blob. */
export async function generarImagenPedido(p) {
  const items = p.items || [];
  const [fotos, parches] = await Promise.all([
    Promise.all(items.map((it) => cargarImagen(it.fotos?.[0]))),
    Promise.all(items.map((it) => (it.fotoParche ? cargarImagen(it.fotoParche, "c_limit,w_600,h_300") : null))),
  ]);

  const altoTitulo = 92;
  const altoTotales = 120;
  const W = ANCHO + PAD * 2;
  const H = PAD + altoTitulo + ALTO_HEAD + ALTO_FILA * Math.max(1, items.length) + altoTotales + PAD;

  const escala = 2; // nítida en el celular
  const canvas = document.createElement("canvas");
  canvas.width = W * escala;
  canvas.height = H * escala;
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);
  ctx.textBaseline = "middle";

  // Fondo
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título
  let y = PAD;
  ctx.fillStyle = "#000";
  ctx.font = `900 30px ${FONT}`;
  ctx.fillText(`ChemaSport ER · Pedido #${p.numero}`, PAD, y + 30);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = "#52525b";
  const sub = [p.cliente?.nombre, p.cliente?.telefono, p.fecha].filter(Boolean).join("  ·  ");
  ctx.fillText(sub, PAD, y + 66);
  y += altoTitulo;

  // Encabezado (negro, como la hoja)
  let x = PAD;
  ctx.fillStyle = "#000";
  ctx.fillRect(PAD, y, ANCHO, ALTO_HEAD);
  ctx.fillStyle = "#fff";
  ctx.font = `800 17px ${FONT}`;
  ctx.textAlign = "center";
  for (const c of COLS) {
    ctx.fillText(c.label, x + c.w / 2, y + ALTO_HEAD / 2);
    x += c.w;
  }
  y += ALTO_HEAD;

  // Filas
  items.forEach((it, i) => {
    const valores = {
      equipo: it.equipo,
      talla: tallaHoja(it),
      version: it.version,
      dorsal: it.dorsal || "N/A",
      nombre: it.nombre || "N/A",
      parche: sinParche(it.parche) ? (it.fotoParche ? "" : "N/A") : it.parche,
      cantidad: String(it.cantidad || 1),
      cliente: p.cliente?.nombre,
    };
    if (i % 2) {
      ctx.fillStyle = "#f4f4f5";
      ctx.fillRect(PAD, y, ANCHO, ALTO_FILA);
    }
    x = PAD;
    for (const c of COLS) {
      // 🟨 Resaltados en amarillo (como en la hoja de Johanna)
      if ((c.key === "talla" && it.manga === "Larga") || ((c.key === "dorsal" || c.key === "nombre") && resaltarDorsal(it))) {
        ctx.fillStyle = AMARILLO;
        ctx.fillRect(x, y, c.w, ALTO_FILA);
      }
      if (c.key === "img") {
        const img = fotos[i];
        const fw = 120, fh = 140;
        const fx = x + (c.w - fw) / 2, fy = y + (ALTO_FILA - fh) / 2;
        if (img) {
          // recorte tipo "cover"
          const r = Math.max(fw / img.width, fh / img.height);
          const sw = fw / r, sh = fh / r;
          ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, fx, fy, fw, fh);
        } else {
          ctx.fillStyle = "#e4e4e7";
          ctx.fillRect(fx, fy, fw, fh);
          ctx.fillStyle = "#a1a1aa";
          ctx.font = `700 14px ${FONT}`;
          ctx.fillText("Sin foto", fx + fw / 2, fy + fh / 2);
        }
      } else {
        // Como la hoja: equipo normal; talla, versión, número, nombre y parche en negrita
        const destacado = ["talla", "version", "dorsal", "nombre", "parche"].includes(c.key);
        ctx.fillStyle = "#000";
        ctx.font = `${destacado ? 800 : 400} ${c.key === "equipo" ? 20 : 18}px ${FONT}`;
        const parcheImg = c.key === "parche" ? parches[i] : null;
        const conTexto = Boolean(valores[c.key]);
        // 📸 Foto del parche: ocupa toda la celda, o la parte de arriba si también hay texto
        if (parcheImg) {
          const alto = conTexto ? ALTO_FILA - 62 : ALTO_FILA - 16;
          dibujarContenida(ctx, parcheImg, x + 8, y + 8, c.w - 16, alto);
        }
        const lineas = partir(ctx, valores[c.key], c.w - 20, parcheImg ? 2 : 4);
        const altoLinea = 24;
        const centro = parcheImg ? y + ALTO_FILA - 12 - (lineas.length * altoLinea) / 2 : y + ALTO_FILA / 2;
        const y0 = centro - ((lineas.length - 1) * altoLinea) / 2;
        lineas.forEach((l, k) => ctx.fillText(l, x + c.w / 2, y0 + k * altoLinea));
      }
      x += c.w;
    }
    y += ALTO_FILA;
  });

  // Cuadrícula
  const yTabla = PAD + altoTitulo;
  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD + 0.5, yTabla + 0.5, ANCHO - 1, y - yTabla - 1);
  x = PAD;
  for (const c of COLS.slice(0, -1)) {
    x += c.w;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, yTabla);
    ctx.lineTo(x + 0.5, y);
    ctx.stroke();
  }
  for (let k = 0; k <= items.length; k++) {
    const yy = yTabla + ALTO_HEAD + k * ALTO_FILA;
    ctx.beginPath();
    ctx.moveTo(PAD, yy + 0.5);
    ctx.lineTo(PAD + ANCHO, yy + 0.5);
    ctx.stroke();
  }

  // Totales
  const saldo = saldoDe(p);
  const pagado = pagadoDe(p);
  ctx.textAlign = "left";
  y += 40;
  ctx.font = `800 22px ${FONT}`;
  const partes = [
    ["Total", colones(p.total), "#000"],
    [(p.abonos || []).length ? "Pagado" : "Adelanto", colones(pagado), "#15803d"],
    ["Pendiente", colones(saldo), saldo > 0 ? "#dc2626" : "#15803d"],
  ];
  x = PAD;
  for (const [label, valor, color] of partes) {
    ctx.fillStyle = "#52525b";
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`${label}:`, x, y);
    x += ctx.measureText(`${label}: `).width;
    ctx.fillStyle = color;
    ctx.font = `900 22px ${FONT}`;
    ctx.fillText(valor, x, y);
    x += ctx.measureText(valor).width + 48;
  }
  ctx.fillStyle = "#52525b";
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("Por favor revisá que equipo, talla, nombre, número y parches estén correctos.", PAD, y + 44);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png")
  );
}

/**
 * Comparte la imagen (celular: menú de compartir → WhatsApp). En compu la copia para pegarla en WhatsApp Web
 * y si no se puede, la descarga. Devuelve "compartida" | "copiada" | "descargada" | "cancelada".
 */
export async function compartirImagenPedido(p) {
  const blob = await generarImagenPedido(p);
  const nombre = `pedido-${p.numero}.png`;
  const file = new File([blob], nombre, { type: "image/png" });
  const esCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (esCelular && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Pedido #${p.numero}` });
      return "compartida";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelada";
    }
  }
  if (!esCelular && navigator.clipboard?.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      return "copiada";
    } catch { /* sin permiso: se descarga */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "descargada";
}
