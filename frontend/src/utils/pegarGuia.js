// 📋 Lee los datos que manda el cliente por WhatsApp y los separa para la guía de mensajero.
// Formato esperado (con o sin números adelante, una cosa por línea):
//   Nombre / Provincia / Cantón / Distrito / Señas / Teléfono
// Provincia, cantón y distrito se buscan en el catálogo oficial (crUbicaciones.json) sin tildes ni mayúsculas.
// "Central" / "Centro" como cantón = el cantón cabecera (mismo nombre que la provincia).
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

// 📞 Devuelve el teléfono (8 dígitos) si la línea es solo un número
const leerTelefono = (linea) => {
  if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(linea.replace(/tel[eé]fono|cel(ular)?|whatsapp|tel/gi, ""))) return null;
  const digitos = linea.replace(/\D/g, "").replace(/^506(?=\d{8}$)/, "");
  return digitos.length === 8 ? digitos : null;
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

export function leerDatosGuia(texto) {
  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map(quitarNumeracion)
    .filter(Boolean);

  let telefono = "";
  const resto = [];
  for (const l of lineas) {
    const tel = !telefono && leerTelefono(l);
    if (tel) telefono = tel;
    else resto.push(l);
  }

  // 🗺️ La provincia marca dónde empieza la dirección
  const nombresProv = UBICACIONES.map((p) => p.n);
  const iProv = resto.findIndex((l) => nombresProv.some((p) => norm(p) === norm(l)));

  let nombre = "", provincia = "", canton = "", distrito = "";
  const senas = [];

  if (iProv >= 0) {
    provincia = nombresProv.find((p) => norm(p) === norm(resto[iProv]));
    nombre = resto.slice(0, iProv).join(" ").trim();
    const prov = UBICACIONES.find((p) => p.n === provincia);

    let i = iProv + 1;
    const lCanton = resto[i];
    if (lCanton !== undefined) {
      const c = ES_CENTRAL(lCanton)
        ? prov.c.find((x) => norm(x.n) === norm(provincia))
        : prov.c.find((x) => x.n === buscar(lCanton, prov.c.map((y) => y.n)));
      if (c) { canton = c.n; i++; }
      // Si no se reconoce, igual se salta (era el cantón mal escrito) → se escoge a mano
      else i++;

      const lDistrito = resto[i];
      if (lDistrito !== undefined) {
        if (c) {
          const d = ES_CENTRAL(lDistrito)
            ? c.d.find((x) => norm(x) === norm(c.n))
            : buscar(lDistrito, c.d);
          if (d) distrito = d;
        }
        i++;
      }
    }
    senas.push(...resto.slice(i));
  } else {
    // Sin provincia reconocida: la primera línea es el nombre y lo demás son señas
    nombre = resto[0] || "";
    senas.push(...resto.slice(1));
  }

  return {
    nombre,
    provincia,
    canton,
    distrito,
    telefono,
    senas: senas.join(" ").trim(),
  };
}
