// 📋 Texto del botón "Copiar" del historial (formato guía: CLIENTE / CAMISETA / UBICACIÓN / Vendedor).
// Lo usan HistoryPage y el panel de Ventas web (botón "Copiar historial" de cada orden), así sale igual en los dos.

// 🛡 PARSEO INDESTRUCTIBLE DE TALLAS Y DORSALES PARA EL BOTÓN DE COPIAR
export function parseLogDetails(log) {
  let detailsStr = "";
  if (typeof log?.details === "string") {
    detailsStr = log.details;
  } else if (log?.details && typeof log.details === "object") {
    detailsStr = JSON.stringify(log.details);
  }

  // Limpiamos el ID del texto antes de buscar
  detailsStr = detailsStr.replace(/\[ID:[^\]]+\]\s*\|\s*/g, "");

  let cliente = "No especificado";
  const matchCliente = detailsStr.match(/Cliente:\s*([^|]+)/i);
  if (matchCliente && matchCliente[1]) cliente = matchCliente[1].trim();

  const vendedor = log?.user || log?.vendedor || "Sistema";
  const nombreChema = log?.item || "No especificado";

  // 🔥 DETECTAR SI INCLUYE DORSAL IMPRESO EN EL HISTORIAL 🔥
  let dorsalLinea = "";
  const matchDorsal = detailsStr.match(/Dorsal Impreso:\s*([^|]+)/i);
  if (matchDorsal && matchDorsal[1]) {
    dorsalLinea = `Numero: ${matchDorsal[1].trim()} (impresion)`;
  }

  const items = [];
  let hasMatches = false;

  const segmentos = detailsStr.split('|');

  segmentos.forEach(segmento => {
    const regex = /\[(.*?)\]\s*:\s*(\d+)\s*(?:->|→|-|to)\s*(\d+)/gi;
    let match;

    while ((match = regex.exec(segmento)) !== null) {
      const talla = String(match[1]).trim();
      const oldV = parseInt(match[2], 10) || 0;
      const newV = parseInt(match[3], 10) || 0;

      let tienda = "Tienda";
      if (segmento.includes("Bodega 2") || segmento.includes("Tienda #2")) {
        tienda = "Bodega 2";
      } else if (segmento.includes("Bodega 1") || segmento.includes("Tienda #1")) {
        tienda = "Bodega 1";
      }

      if (oldV > newV) {
        hasMatches = true;
        const cantidad = oldV - newV;

        for (let i = 0; i < cantidad; i++) {
          let bloque = `•⁠  ⁠CAMISETA: ${nombreChema} talla ${talla}\nUBICACIÓN: ${tienda}`;
          if (dorsalLinea) bloque += `\n${dorsalLinea}`;
          items.push(bloque);
        }
      }
    }
  });

  if (!hasMatches) {
    let tiendaF = "General";
    if (detailsStr.includes("Bodega 2") || detailsStr.includes("Tienda #2")) tiendaF = "Bodega 2";
    else if (detailsStr.includes("Bodega 1") || detailsStr.includes("Tienda #1")) tiendaF = "Bodega 1";
    else if (detailsStr.includes("Tienda")) tiendaF = "Tienda";
    
    let bloque = `•⁠  ⁠CAMISETA: ${nombreChema}\nUBICACIÓN: ${tiendaF}`;
    if (dorsalLinea) bloque += `\n${dorsalLinea}`;
    items.push(bloque);
  }

  return { cliente, vendedor, items };
}

export function extractGuideData(log) {
  const data = parseLogDetails(log);
  return `CLIENTE: ${data.cliente}\n${data.items.join('\n')}\nVendedor: ${data.vendedor}`;
}

// 🔗 Varios registros juntos (igual que "JUNTAR Y COPIAR"): un solo CLIENTE y Vendedor, todas las camisetas
export function juntarGuias(logs) {
  if (!logs?.length) return "";
  if (logs.length === 1) return extractGuideData(logs[0]);
  let cliente = "No especificado";
  let vendedor = "Sistema";
  const allItems = [];
  logs.forEach((log, index) => {
    const data = parseLogDetails(log);
    if (index === 0 || cliente === "No especificado") cliente = data.cliente;
    if (index === 0 || vendedor === "Sistema") vendedor = data.vendedor;
    allItems.push(...data.items);
  });
  return `CLIENTE: ${cliente}\n${allItems.join('\n')}\nVendedor: ${vendedor}`;
}
