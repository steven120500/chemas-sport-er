// 📋 Lee los datos que manda el cliente por WhatsApp y los separa para la guía de mensajero.
// Sirve en dos formatos (una cosa por línea, con o sin números adelante):
//   1) Sin etiquetas, en orden: Nombre / Provincia / Cantón / Distrito / Señas / Teléfono
//   2) Con etiquetas: "Nombre completo: …", "Provincia: …", "Cantón: …", "Señas exactas …: …", "Número telefónico: …"
// Provincia, cantón y distrito se buscan en el catálogo oficial (crUbicaciones.json) sin tildes ni mayúsculas.
// "Central" / "Centro" = el cantón (o distrito) cabecera (mismo nombre que la provincia / cantón).
import UBICACIONES from "./crUbicaciones.json";

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const ES_CENTRAL = (s) => ["central", "centro", "canton central", "cabecera"].includes(norm(s));

// 👈 Quita "1.", "2)", "3-", "5 " del inicio (sin comerse un teléfono)
const quitarNumeracion = (linea) =>
  linea.replace(/^\s*\d{1,2}\s*[.)\-:]\s*/, "").replace(/^\s*\d{1,2}\s+(?=\D)/, "").trim();

// 📞 Saca los 8 dígitos del teléfono (quita +506, espacios y guiones)
const digitosTel = (txt) => {
  const d = String(txt || "").replace(/\D/g, "").replace(/^506(?=\d{8}$)/, "");
  return d.length === 8 ? d : "";
};

// 📞 Una línea sin etiqueta que es solo un número
const leerTelefono = (linea) => (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(linea) ? "" : digitosTel(linea));

// 🏷️ Etiquetas que suelen mandar los clientes (el orden importa: la primera que calce gana)
const ETIQUETAS = [
  ["telefono", /tel[eé]f|celular|\bcel\b|whats|n[uú]mero|contacto/i],
  ["senas", /se[nñ]as|direcci[oó]n|ubicaci[oó]n|referencia|exacta/i],
  ["provincia", /provincia/i],
  ["canton", /cant[oó]n/i],
  ["distrito", /distrito/i],
  ["nombre", /nombre|cliente|recibe/i],
];

// "Provincia: San José" → { campo: "provincia", valor: "San José" }
const leerEtiqueta = (linea) => {
  const m = linea.match(/^([^:]{2,70}):\s*(.*)$/);
  if (!m) return null;
  const campo = ETIQUETAS.find(([, re]) => re.test(m[1]))?.[0];
  return campo ? { campo, valor: m[2].trim() } : null;
};

// 🔎 Busca un nombre en una lista: igual primero, después uno contiene al otro (el más largo gana)
const buscar = (texto, lista) => {
  const t = norm(texto);
  if (!t) return null;
  const exacto = lista.find((x) => norm(x) === t);
  if (exacto) return exacto;
  const parecidos = lista.filter((x) => {
    const n = norm(x);
    return Math.min(n.length, t.length) >= 4 && (n.includes(t) || t.includes(n));
  });
  return parecidos.sort((a, b) => b.length - a.length)[0] || null;
};

// 🗺️ Texto libre → nombres oficiales del catálogo
const resolverUbicacion = (provTxt, cantonTxt, distritoTxt) => {
  const prov = UBICACIONES.find((p) => p.n === buscar(provTxt, UBICACIONES.map((x) => x.n)));
  if (!prov) return { provincia: "", canton: "", distrito: "" };
  const c = !cantonTxt
    ? null
    : ES_CENTRAL(cantonTxt)
      ? prov.c.find((x) => norm(x.n) === norm(prov.n))
      : prov.c.find((x) => x.n === buscar(cantonTxt, prov.c.map((y) => y.n)));
  let distrito = "";
  if (c && distritoTxt) {
    distrito = (ES_CENTRAL(distritoTxt) ? c.d.find((x) => norm(x) === norm(c.n)) : buscar(distritoTxt, c.d)) || "";
  }
  return { provincia: prov.n, canton: c?.n || "", distrito };
};

export function leerDatosGuia(texto) {
  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map(quitarNumeracion)
    .filter(Boolean);

  // 1️⃣ Primero lo que viene con etiqueta ("Provincia: …"); si la etiqueta queda sola, el valor es la línea siguiente
  const etiquetado = {};
  const sueltas = [];
  for (let i = 0; i < lineas.length; i++) {
    const e = leerEtiqueta(lineas[i]);
    if (!e) { sueltas.push(lineas[i]); continue; }
    let valor = e.valor;
    if (!valor && lineas[i + 1] && !leerEtiqueta(lineas[i + 1])) valor = lineas[++i];
    if (valor && !etiquetado[e.campo]) etiquetado[e.campo] = valor;
  }

  let telefono = digitosTel(etiquetado.telefono);
  const resto = [];
  for (const l of sueltas) {
    const tel = !telefono && leerTelefono(l);
    if (tel) telefono = tel;
    else resto.push(l);
  }

  // 2️⃣ Lo que vino sin etiqueta: en orden, la provincia marca dónde empieza la dirección
  let nombre = "", provTxt = "", cantonTxt = "", distritoTxt = "";
  const senas = [];
  const nombresProv = UBICACIONES.map((p) => p.n);
  const iProv = resto.findIndex((l) => nombresProv.some((p) => norm(p) === norm(l)));

  if (iProv >= 0) {
    nombre = resto.slice(0, iProv).join(" ").trim();
    provTxt = resto[iProv];
    cantonTxt = resto[iProv + 1] || "";
    distritoTxt = resto[iProv + 2] || "";
    senas.push(...resto.slice(iProv + 3));
  } else if (!etiquetado.nombre) {
    // Sin provincia reconocida: la primera línea es el nombre y lo demás son señas
    nombre = resto[0] || "";
    senas.push(...resto.slice(1));
  } else {
    senas.push(...resto);
  }

  // Lo etiquetado manda sobre lo que se adivinó por orden
  const ubic = resolverUbicacion(
    etiquetado.provincia || provTxt,
    etiquetado.canton || cantonTxt,
    etiquetado.distrito || distritoTxt
  );

  return {
    nombre: (etiquetado.nombre || nombre).trim(),
    ...ubic,
    telefono,
    senas: [etiquetado.senas, ...senas].filter(Boolean).join(" ").trim(),
  };
}
