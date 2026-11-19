// 🛵 Cobertura del mensajero privado (Mensajería ABM, tabla "Cobertura GAM", nov-2026).
// Solo se ofrece "Mensajero" si provincia + cantón + distrito están acá. Precio fijo (decisión del dueño),
// aunque la tabla del mensajero cobra ₡3.000 en Guácima, Paraíso y Llanos de Santa Lucía.
// Los nombres deben coincidir con utils/crUbicaciones.json (se comparan sin tildes ni mayúsculas).
// ⚠️ Cuando se conecte Tilopay, el backend debe validar esto mismo (no confiar en el precio del navegador).

export const COSTO_MENSAJERO = 2500;

const COBERTURA = {
  "San José": {
    "San José": ["Carmen", "Merced", "Hospital", "Catedral", "Zapote", "San Francisco de Dos Rios", "Uruca", "Mata Redonda", "Pavas", "Hatillo", "San Sebastián"],
    "Escazú": ["Escazú", "San Rafael", "San Antonio"],
    "Desamparados": ["Desamparados", "San Miguel", "San Juan de Dios", "San Rafael Arriba", "San Rafael Abajo", "San Antonio", "Patarra", "Gravilias", "Los Guido"],
    "Aserrí": ["Aserrí", "Salitrillos"],
    "Mora": ["Colón"],
    "Goicoechea": ["Guadalupe", "San Francisco", "Calle Blancos", "Mata de Platano", "Ipis", "Rancho Redondo", "Purral"],
    "Santa Ana": ["Santa Ana", "Piedades", "Brasil", "Uruca", "Pozos", "Salitral"],
    "Alajuelita": ["Alajuelita", "San Antonio", "San Felipe", "San Josecito", "Concepción"],
    "Vázquez de Coronado": ["San Isidro", "San Rafael", "Dulce Nombre de Jesus", "Patalillo"],
    "Tibás": ["San Juan", "Cinco Esquinas", "Anselmo Llorente", "León XIII", "Colima"],
    "Moravia": ["San Vicente", "San Jerónimo", "La Trinidad"],
    "Montes de Oca": ["San Pedro", "Sabanilla", "Mercedes", "San Rafael"],
    "Curridabat": ["Curridabat", "Granadilla", "Sánchez", "Tirrases"],
  },
  "Alajuela": {
    "Alajuela": ["Alajuela", "San José", "Guácima", "San Antonio", "San Rafael", "Río Segundo", "Desamparados"],
  },
  "Cartago": {
    "Cartago": ["Oriental", "Occidental", "Carmen", "San Nicolás", "Aguacaliente o San Francisco", "Guadalupe o Arenilla", "Dulce Nombre"],
    "Paraíso": ["Paraíso", "Llanos de Santa Lucía"],
    "La Unión": ["Tres Ríos", "San Diego", "San Juan", "San Rafael", "Concepción", "Dulce Nombre", "San Ramón", "Río Azul"],
    "Oreamuno": ["San Rafael"],
    "El Guarco": ["El Tejar"],
  },
  "Heredia": {
    "Heredia": ["Heredia", "Mercedes", "San Francisco", "Ulloa"],
    "Barva": ["Barva", "San Pedro", "San Pablo", "San Roque", "Santa Lucía"],
    "Santo Domingo": ["Santo Domingo", "San Vicente", "San Miguel", "Paracito", "Santo Tomás", "Santa Rosa", "Tures", "Pará"],
    "Santa Bárbara": ["Santa Bárbara", "San Pedro", "San Juan", "Jesús"],
    "San Rafael": ["San Rafael", "San Josecito", "Concepción", "Santiago"],
    "San Isidro": ["San Isidro", "San Francisco", "San José", "Concepción"],
    "Belén": ["San Antonio", "La Ribera", "La Asunción"],
    "Flores": ["San Joaquín", "Barrantes", "Llorente"],
    "San Pablo": ["San Pablo", "Rincón de Sabanilla"],
  },
};

const norm = (s = "") =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const SET = new Set();
for (const [p, cantones] of Object.entries(COBERTURA))
  for (const [c, distritos] of Object.entries(cantones))
    for (const d of distritos) SET.add(`${norm(p)}|${norm(c)}|${norm(d)}`);

/** ¿El mensajero llega a esta dirección? */
export const hayMensajero = (provincia, canton, distrito) =>
  Boolean(provincia && canton && distrito) && SET.has(`${norm(provincia)}|${norm(canton)}|${norm(distrito)}`);

// Para revisar que todo calce con el catálogo (scripts / pruebas)
export const _coberturaPlana = () => [...SET];
