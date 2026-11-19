// utils/guiaPdfCorreos.js
// 🖨️ PDF de la guía de Correos de CR hecho en el servidor (pdfkit) para mandarlo solo al correo del cliente
// en las ventas web. Es la misma hoja que arma el navegador en frontend/src/utils/guiasPdf.js
// (generarPdfOficialCorreos): código de barras Code 128B, remitente, destinatario, detalle y notas legales.
import PDFDocument from 'pdfkit';

const PATRONES_128 = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000', '10011000100',
  '10001100100', '11001001000', '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', '10111001100',
  '10011101100', '10011100110', '11001110010', '11001011100', '11001001110', '11011100100', '11001110100', '11101101110',
  '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010', '11011011000', '11011000110',
  '11000110110', '10100011000', '10001011000', '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110',
  '11101110110', '11010001110', '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110',
  '11100010110', '11101101000', '11101100010', '11100011010', '11101111010', '11001000010', '11110001010', '10100110000',
  '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000', '10110000100', '10011010000',
  '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', '10011110010', '11110100100', '11110010100',
  '11110010010', '11011011110', '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', '10111101000',
  '10111100010', '11110101000', '11110100010', '10111011110', '10111101110', '11101011110', '11110101110', '11010000100',
  '11010010000', '11010011100', '1100011101011',
];

function binario128B(texto) {
  const str = String(texto || '').trim();
  let checksum = 104;
  let bin = PATRONES_128[104];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 32;
    const ok = code >= 0 && code < 95 ? code : 0;
    checksum += ok * (i + 1);
    bin += PATRONES_128[ok];
  }
  return bin + PATRONES_128[checksum % 103] + PATRONES_128[106];
}

const mm = (v) => v * 2.83465;

/** Devuelve un Buffer con el PDF. `g`: { enviold, nombre, telefono, tipoEnvio, direccion, detalleEnvio, codigoPostal, codigoSucursal, fechaFormateada } */
export function pdfGuiaCorreos(g) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const partes = [];
    doc.on('data', (c) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const W = mm(210);
    const M = mm(18);
    const ancho = W - M * 2;
    let y = mm(12);
    const codigo = String(g.enviold || '');

    // 1. Código de barras
    const bin = binario128B(codigo);
    const anchoBarras = mm(95);
    const barra = anchoBarras / bin.length;
    const x0 = (W - anchoBarras) / 2;
    for (let i = 0; i < bin.length; i++) if (bin[i] === '1') doc.rect(x0 + i * barra, y, barra, mm(16)).fill('#000');
    y += mm(19);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text(codigo, 0, y, { width: W, align: 'center' });
    y += mm(6);
    doc.font('Helvetica').fontSize(7.5).text(`Creado : ${g.fechaFormateada || ''}`, M, y, { width: ancho, align: 'right' });
    y += mm(4);
    doc.font('Helvetica-Oblique').text('Guía de envío del servicio EMS Nacional de Correos de Costa Rica', M, y);
    y += mm(4.5);
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).stroke();
    y += mm(4);

    // 2. Remitente / destinatario
    const colI = M;
    const colD = W / 2 + mm(4);
    const anchoCol = ancho / 2 - mm(6);
    doc.font('Helvetica-Bold').fontSize(8.5).text('Datos del Remitente', colI, y).text('Datos del Destinatario', colD, y);
    y += mm(5);

    const linea = (x, yy, etiqueta, valor) => {
      doc.fontSize(7.5).font('Helvetica-Bold').text(etiqueta, x, yy, { width: anchoCol, continued: true }).font('Helvetica').text(` ${valor || ''}`);
      return doc.y + mm(1);
    };
    const bloque = (x, yy, etiqueta, valor) => {
      doc.fontSize(7.5).font('Helvetica-Bold').text(etiqueta, x, yy, { width: anchoCol });
      doc.font('Helvetica').text(valor || '', x, doc.y + mm(0.5), { width: anchoCol });
      return doc.y + mm(1);
    };

    let yR = linea(colI, y, 'Nombre del remitente:', 'CHEMASPORT ER SOCIEDAD DE RESPONSABILIDAD LIMITADA');
    yR = linea(colI, yR, 'Código postal:', '20307');
    yR = linea(colI, yR, 'Teléfono:', '71103209');
    yR = linea(colI, yR, 'Correo electrónico:', 'chemasport_er@outlook.com');
    yR = bloque(colI, yR, 'Dirección:', 'Alajuela, Grecia, Puente de Piedra, Condominio Lomas del Bosque');

    let yD = bloque(colD, y, 'Nombre del destinatario:', g.nombre);
    yD = linea(colD, yD, 'Código postal:', g.codigoPostal);
    yD = linea(colD, yD, 'Teléfono:', g.telefono);
    yD = linea(colD, yD, 'Tipo de envio:', g.tipoEnvio || 'Domicilio');
    yD = linea(colD, yD, 'Sucursal:', g.codigoSucursal);
    yD = bloque(colD, yD, 'Dirección:', g.direccion);

    y = Math.max(yR, yD) + mm(3);
    doc.moveTo(M, y).lineTo(W - M, y).stroke();
    y += mm(3);

    // 3. Detalle
    doc.font('Helvetica-Bold').fontSize(8.5).text('Detalle del paquete', 0, y, { width: W, align: 'center' });
    y = doc.y + mm(1.5);
    doc.fontSize(7.5).font('Helvetica-Bold').text('Detalle:', M, y, { width: ancho, continued: true }).font('Helvetica').text(` ${g.detalleEnvio || 'Paquete'}`);
    y = doc.y + mm(2.5);
    doc.moveTo(M, y).lineTo(W - M, y).stroke();
    y += mm(3);

    // 4. Rastreo y notas legales
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#329600').text('Rastrear Envío', M, y);
    doc.fillColor('#000').font('Helvetica').fontSize(7)
      .text('Esta guía no tiene validez si no ha sido entregada a Correos de Costa Rica. Rastreá tu paquete en https://correos.go.cr/rastreo/', M, doc.y + mm(1.5), { width: ancho });
    doc.fontSize(6.5).text(
      'AUTORIZO de forma expresa a la empresa CORREOS DE COSTA RICA S.A., para que en caso de que el paquete impuesto por el suscrito, presente alguna alerta por motivos de seguridad, de aduanas o por motivos de regulación, esta podrá abrir e inspeccionar mi envío, sin notificación previa de forma tal que gestione el riesgo de envío ilícitos.',
      M, doc.y + mm(2), { width: ancho, align: 'justify' }
    );
    doc.text('CONDICIONES GENERALES DEL SERVICIO EMS: Disponibles en el sitio web https://correos.go.cr', M, doc.y + mm(2), { width: ancho });
    doc.text('Contáctenos al Teléfono (506) 2257-8888 o al correo electrónico: srvcliente@correos.go.cr', M, doc.y + mm(0.5), { width: ancho });
    const yFin = doc.y + mm(4);
    doc.font('Helvetica-Bold').fontSize(8.5).text('CORREOS', M, yFin).text('EMS', W - M - mm(15), yFin);

    doc.end();
  });
}
