// utils/guiasPdf.js
// 🖨️ PDFs de guías (movidos sin cambios desde GuiasPage y GuiasCorreos para reusarlos en Pedidos).
import jsPDF from "jspdf";
import { REMITENTE_CORREOS } from "./tiendaFisica";

function limpiarMontoCR(val) {
  if (typeof val === "number" && !isNaN(val)) return Math.round(val);
  if (!val) return 0;
  const soloDigitos = String(val).replace(/\D/g, "");
  return Number(soloDigitos) || 0;
}

// 📅 "2026-11-16" → "Lunes 16 de Noviembre" (fecha de entrega en el centro de la guía de mensajero)
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export function textoFechaEntrega(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!m) return "";
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); // 👈 hora local, sin corrimiento de zona
  if (isNaN(fecha)) return "";
  return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

// jsPDF por CDN (así lo usaba GuiasPage para la guía de mensajero)
export function cargarJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf && window.jspdf.jsPDF) {
      return resolve(window.jspdf.jsPDF);
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error("No se pudo inicializar jsPDF"));
      }
    };
    script.onerror = () => reject(new Error("Error cargando librería PDF"));
    document.body.appendChild(script);
  });
}

/** Arma el PDF 4x6 de la guía de mensajero. Devuelve { doc, fileName } (no lo descarga). */
export async function generarPdfMensajero(guia) {
  const jsPDF = await cargarJsPDF();
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [101.6, 152.4]
  });

  const montoGuia = limpiarMontoCR(guia.monto);
  const cobroPendiente = guia.debe === "Sí" && montoGuia > 0;
  const esMayorista = guia.esMayorista === "Sí";
  const fechaEntrega = textoFechaEntrega(guia.fechaEntrega);

  const ALTO_HOJA = 152.4;
  const MARGEN_ABAJO = 4;
  const margenIzq = 6;
  const anchoMax = 89.6;

  // 📏 Dibuja toda la guía a una escala dada. Con dibujar=false solo mide hasta dónde llega.
  // Si los comentarios son largos, se va achicando todo hasta que quepa en una sola hoja.
  const maquetar = (k, dibujar) => {
    const txt = (...args) => { if (dibujar) doc.text(...args); };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18 * k);
    txt("Mensajería Privada", 50.8, 13 * k, { align: "center" });

    const yTitulo = 16.5 * k;
    if (dibujar) {
      doc.setLineWidth(0.6);
      doc.line(6, yTitulo, 95.6, yTitulo);
    }

    let y = yTitulo + 8.5 * k;
    const lh = 6 * k; // alto de línea
    const altoRenglon = 12 * k * 0.3528 * 1.15; // 👈 lo que jsPDF deja entre renglones de un mismo texto (pt → mm)

    const agregarCampo = (etiqueta, valor) => {
      const textoValor = String(valor || "").trim();
      if (!textoValor) return;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12 * k);

      if (etiqueta === "Comentarios" || etiqueta === "Cambio") {
        txt(`${etiqueta}:`, margenIzq, y);
        y += lh;
        doc.setFont("helvetica", "normal");
        const lineasValor = doc.splitTextToSize(textoValor, anchoMax);
        txt(lineasValor, margenIzq, y, { lineHeightFactor: 1.15 });
        y += (lineasValor.length - 1) * altoRenglon + 10 * k;
      } else {
        txt(`${etiqueta}:`, margenIzq, y);
        doc.setFont("helvetica", "normal");
        const sangria = 26 * k;
        const lineasValor = doc.splitTextToSize(textoValor, anchoMax - sangria);
        txt(lineasValor, margenIzq + sangria, y, { lineHeightFactor: 1.15 });
        y += (lineasValor.length - 1) * altoRenglon + 9 * k;
      }
    };

    agregarCampo("Nombre", guia.nombre);
    agregarCampo("Provincia", guia.provincia);
    agregarCampo("Cantón", guia.canton);
    agregarCampo("Distrito", guia.distrito);
    agregarCampo("Teléfono", guia.telefono);
    agregarCampo("Debe", cobroPendiente ? `¢${montoGuia.toLocaleString("es-CR")}` : "No");
    agregarCampo("Raspa", guia.meterRaspa);
    // 🔄 Cambio: el mensajero recoge lo que devuelve el cliente
    if (guia.esCambio === "Sí") agregarCampo("Cambio", guia.detalleCambio || "Sí");
    agregarCampo("Comentarios", guia.comentarios);

    let yFinal = y - 3 * k;

    // 📅 Fecha de entrega grande en el centro (normal o mayorista)
    if (fechaEntrega) {
      const yCaja = Math.max(y + 1 * k, 74);
      const altoCaja = 16 * k;
      if (dibujar) {
        doc.setLineWidth(0.6);
        doc.rect(6, yCaja, 89.6, altoCaja);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * k);
      txt("ENTREGAR EL", 50.8, yCaja + 4.5 * k, { align: "center" });
      doc.setFontSize((fechaEntrega.length > 22 ? 17 : 20) * k);
      txt(fechaEntrega, 50.8, yCaja + 12.5 * k, { align: "center" });
      y = yCaja + altoCaja + 4 * k;
      yFinal = yCaja + altoCaja;
    }

    if (esMayorista && guia.nombreMayorista) {
      const yLinea = Math.max(y + 2 * k, 115);
      if (dibujar) {
        doc.setLineWidth(0.7);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(6, yLinea, 95.6, yLinea);
        doc.setLineDashPattern([], 0);
      }

      const textoMay = guia.nombreMayorista.toUpperCase();

      let tamFuente = 24;
      if (textoMay.length > 12) tamFuente = 18;
      if (textoMay.length > 20) tamFuente = 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(tamFuente * k);

      const lineasMayorista = doc.splitTextToSize(textoMay, 88);
      const altoLineaMay = tamFuente * k * 0.3528 * 1.15; // pt → mm
      const yTexto = yLinea + 10 * k;
      txt(lineasMayorista, 50.8, yTexto, { align: "center" });
      yFinal = yTexto + (lineasMayorista.length - 1) * altoLineaMay + altoLineaMay * 0.3;
    }

    return yFinal;
  };

  // 🔍 Buscar la escala más grande que quepa en la hoja (mínimo 45%)
  let escala = 1;
  while (escala > 0.45 && maquetar(escala, false) > ALTO_HOJA - MARGEN_ABAJO) {
    escala -= 0.03;
  }
  maquetar(escala, true);

  const nombreLimpio = String(guia.nombre || "Guia").replace(/[\\/:*?"<>|_]/g, "").trim();
  const fileName = `${nombreLimpio}.pdf`;
  return { doc, fileName };
}

// Generador nativo de Código de Barras Code 128B en Base64 (No requiere librerías externas)
const generarBarcodeBase64 = (texto) => {
  const PATTERNS = [
    "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
    "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
    "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
    "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
    "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
    "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
    "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
    "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
    "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
    "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
    "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
    "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
    "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
    "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
    "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
    "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
    "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
    "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
    "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
    "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
    "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
    "11010011100", "1100011101011"
  ];

  const str = String(texto || "PY086032498CR").trim();
  let checksum = 104; // Start Code B
  let binary = PATTERNS[104];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 32;
    const validCode = code >= 0 && code < 95 ? code : 0;
    checksum += validCode * (i + 1);
    binary += PATTERNS[validCode];
  }

  checksum = checksum % 103;
  binary += PATTERNS[checksum] + PATTERNS[106]; // Checksum + Stop

  const canvas = document.createElement("canvas");
  const barWidth = 3;
  const height = 70;
  const padding = 20;
  canvas.width = binary.length * barWidth + padding * 2;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000000";
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "1") {
      ctx.fillRect(padding + i * barWidth, 5, barWidth, height - 10);
    }
  }

  return canvas.toDataURL("image/png");
};

// Función auxiliar para dibujar etiqueta en negrita seguida de valor normal en jsPDF
const drawBoldLabelLine = (doc, label, value, x, y) => {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  const labelWidth = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  doc.text(` ${value || ""}`, x + labelWidth, y);
};

// Función optimizada para generar el PDF compacto en 1 sola hoja con Código de Barras real arriba
export const generarPdfOficialCorreos = (guiaData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const margin = 18;
  let y = 12;

  const codigoGuia = guiaData.enviold || "PY086032498CR";

  // 1. DIBUJAR CÓDIGO DE BARRAS ARRIBA DEL NÚMERO DE GUÍA
  try {
    const barcodeDataUrl = generarBarcodeBase64(codigoGuia);
    const barcodeWidth = 95;
    const barcodeHeight = 16;
    doc.addImage(
      barcodeDataUrl,
      "PNG",
      (pageWidth - barcodeWidth) / 2,
      y,
      barcodeWidth,
      barcodeHeight
    );
    y += barcodeHeight + 5;
  } catch (e) {
    console.error("Error generando código de barras:", e);
    y += 5;
  }

  // Número de Guía debajo del código de barras
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(codigoGuia, pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Creado : ${guiaData.fechaFormateada || "05-11-2026"}`, pageWidth - margin, y, { align: "right" });
  y += 4;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("Guía de envío del servicio EMS Nacional de Correos de Costa Rica", margin, y);
  y += 4;

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // 2. SECCIONES REMITENTE Y DESTINATARIO (Con etiquetas en Negrita exactas al PDF oficial)
  const colIzquierda = margin;
  const colDerecha = pageWidth / 2 + 4;
  const maxColWidth = (pageWidth - margin * 2) / 2 - 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Datos del Remitente", colIzquierda, y);
  doc.text("Datos del Destinatario", colDerecha, y);
  y += 4.5;

  doc.setFontSize(7.5);

  // Bloque Remitente Fijo Chema Sport ER
  let yRemitente = y;
  doc.setFont("helvetica", "bold");
  doc.text("Nombre del remitente:", colIzquierda, yRemitente);
  doc.setFont("helvetica", "normal");
  doc.text(" CHEMASPORT ER SOCIEDAD DE", colIzquierda + doc.getTextWidth("Nombre del remitente:"), yRemitente);
  yRemitente += 3.5;
  doc.text("RESPONSABILIDAD LIMITADA", colIzquierda, yRemitente);
  yRemitente += 4.5;

  drawBoldLabelLine(doc, "Código postal:", REMITENTE_CORREOS.zip, colIzquierda, yRemitente);
  yRemitente += 4;
  drawBoldLabelLine(doc, "Teléfono:", REMITENTE_CORREOS.telefono, colIzquierda, yRemitente);
  yRemitente += 4;
  drawBoldLabelLine(doc, "Correo electrónico:", REMITENTE_CORREOS.correo, colIzquierda, yRemitente);
  yRemitente += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Dirección:", colIzquierda, yRemitente);
  yRemitente += 3.5;
  doc.setFont("helvetica", "normal");
  const lineasDirRem = doc.splitTextToSize(
    REMITENTE_CORREOS.direccion,
    maxColWidth
  );
  doc.text(lineasDirRem, colIzquierda, yRemitente);
  yRemitente += lineasDirRem.length * 3.5;

 // Bloque Destinatario
 let yDestinatario = y;
 doc.setFont("helvetica", "bold");
 doc.text("Nombre del destinatario:", colDerecha, yDestinatario);
 yDestinatario += 4.5;

 doc.setFont("helvetica", "normal");
 const lineasNombreDest = doc.splitTextToSize(guiaData.nombre || "", maxColWidth);
 doc.text(lineasNombreDest, colDerecha, yDestinatario);
 yDestinatario += lineasNombreDest.length * 3.5 + 2;

  drawBoldLabelLine(doc, "Código postal:", guiaData.codigoPostal || "20301", colDerecha, yDestinatario);
  yDestinatario += 4;
  drawBoldLabelLine(doc, "Teléfono:", guiaData.telefono || "", colDerecha, yDestinatario);
  yDestinatario += 4;
  drawBoldLabelLine(doc, "Tipo de envio:", guiaData.tipoEnvio || "Domicilio", colDerecha, yDestinatario);
  yDestinatario += 4;
  drawBoldLabelLine(doc, "Sucursal:", guiaData.codigoSucursal || "", colDerecha, yDestinatario);
  yDestinatario += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Dirección:", colDerecha, yDestinatario);
  yDestinatario += 3.5;
  doc.setFont("helvetica", "normal");
  const lineasDirDest = doc.splitTextToSize(guiaData.direccion || "", maxColWidth);
  doc.text(lineasDirDest, colDerecha, yDestinatario);
  yDestinatario += lineasDirDest.length * 3.5;

  y = Math.max(yRemitente, yDestinatario) + 5;

  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // 3. DETALLE DEL PAQUETE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Detalle del paquete", pageWidth / 2, y, { align: "center" });
  y += 4.5;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle: ", margin, y);
  const anchoLblDetalle = doc.getTextWidth("Detalle: ");
  doc.setFont("helvetica", "normal");
  const lineasDetalle = doc.splitTextToSize(guiaData.detalleEnvio || "Paquete", pageWidth - margin * 2 - anchoLblDetalle);
  doc.text(lineasDetalle, margin + anchoLblDetalle, y);
  y += lineasDetalle.length * 3.5 + 3;

  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // 4. RASTREAR ENVÍO Y NOTAS LEGALES COMPACTAS
  doc.setTextColor(50, 150, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Rastrear Envío", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    "Esta guía no tiene validez si no ha sido entregada a Correos de Costa Rica. Escaneá el código QR para conocer el estado de tu paquete.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );
  y += 8;

  doc.setFontSize(6.5);
  doc.text(
    "AUTORIZO de forma expresa a la empresa CORREOS DE COSTA RICA S.A., para que en caso de que el paquete impuesto por el suscrito, presente alguna alerta por motivos de seguridad, de aduanas o por motivos de regulación, esta podrá abrir e inspeccionar mi envío, sin notificación previa de forma tal que gestione el riesgo de envío ilícitos.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2, align: "justify" }
  );
  y += 12;

  doc.text("CONDICIONES GENERALES DEL SERVICIO EMS: Disponibles en el sitio web https://correos.go.cr", margin, y);
  y += 3.5;
  doc.text("Contáctenos al Teléfono (506) 2257-8888 o al correo electrónico: srvcliente@correos.go.cr", margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CORREOS", margin, y);
  doc.text("EMS", pageWidth - margin - 15, y);

  doc.save(`${codigoGuia}.pdf`);
  return doc; // 👈 Ventas web lo usa para mandar el PDF al correo del cliente
};
