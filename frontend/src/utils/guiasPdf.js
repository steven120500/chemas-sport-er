// utils/guiasPdf.js
// 🖨️ PDFs de guías (movidos sin cambios desde GuiasPage y GuiasCorreos para reusarlos en Pedidos).
import jsPDF from "jspdf";

function limpiarMontoCR(val) {
  if (typeof val === "number" && !isNaN(val)) return Math.round(val);
  if (!val) return 0;
  const soloDigitos = String(val).replace(/\D/g, "");
  return Number(soloDigitos) || 0;
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Mensajería Privada", 50.8, 13, { align: "center" });

  doc.setLineWidth(0.6);
  doc.line(6, 16.5, 95.6, 16.5);

  let y = 25;
  const margenIzq = 6;
  const anchoMax = 89.6;

  const agregarCampo = (etiqueta, valor) => {
    const textoValor = String(valor || "").trim();
    if (!textoValor) return;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    if (etiqueta === "Comentarios") {
      doc.text(`${etiqueta}:`, margenIzq, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const lineasValor = doc.splitTextToSize(textoValor, anchoMax);
      doc.text(lineasValor, margenIzq, y);
      y += (lineasValor.length * 6) + 4;
    } else {
      doc.text(`${etiqueta}:`, margenIzq, y);
      doc.setFont("helvetica", "normal");
      const lineasValor = doc.splitTextToSize(textoValor, anchoMax - 26);
      doc.text(lineasValor, margenIzq + 26, y);
      y += (lineasValor.length * 6) + 3;
    }
  };

  agregarCampo("Nombre", guia.nombre);
  agregarCampo("Provincia", guia.provincia);
  agregarCampo("Cantón", guia.canton);
  agregarCampo("Distrito", guia.distrito);
  agregarCampo("Teléfono", guia.telefono);
  agregarCampo("Debe", cobroPendiente ? `¢${montoGuia.toLocaleString("es-CR")}` : "No");
  agregarCampo("Raspa", guia.meterRaspa);
  agregarCampo("Comentarios", guia.comentarios);

  if (esMayorista && guia.nombreMayorista) {
    const yLinea = Math.max(y + 2, 115);
    doc.setLineWidth(0.7);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(6, yLinea, 95.6, yLinea);
    doc.setLineDashPattern([], 0);

    const textoMay = guia.nombreMayorista.toUpperCase();

    let tamFuente = 24;
    if (textoMay.length > 12) tamFuente = 18;
    if (textoMay.length > 20) tamFuente = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(tamFuente);

    const lineasMayorista = doc.splitTextToSize(textoMay, 88);
    doc.text(lineasMayorista, 50.8, yLinea + 10, { align: "center" });
  }

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

  drawBoldLabelLine(doc, "Código postal:", "20307", colIzquierda, yRemitente);
  yRemitente += 4;
  drawBoldLabelLine(doc, "Teléfono:", "71103209", colIzquierda, yRemitente);
  yRemitente += 4;
  drawBoldLabelLine(doc, "Correo electrónico:", "chemasport_er@outlook.com", colIzquierda, yRemitente);
  yRemitente += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Dirección:", colIzquierda, yRemitente);
  yRemitente += 3.5;
  doc.setFont("helvetica", "normal");
  const lineasDirRem = doc.splitTextToSize(
    "Alajuela, Grecia, Puente de Piedra, Condominio Lomas del Bosque",
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
};
