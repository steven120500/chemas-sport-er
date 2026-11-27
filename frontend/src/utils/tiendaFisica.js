// 🏪 Datos de la tienda física (footer, /ubicacion y retiro en el checkout)
export const DIRECCION_TIENDA = "50 metros oeste de la Estación de Servicio Delta";
export const ZONA_TIENDA = "Grecia, Alajuela";
export const WAZE_TIENDA = "https://waze.com/ul/hd1u131h8m";
export const MAPS_TIENDA = "https://maps.google.com/?cid=9503301042483866711"; // ficha de Google Maps "CHEMASPORT ER"

// 📦 Remitente de las guías de Correos (PDF y pantalla de /guias).
// ⚠️ Copia en api/config/remitente.js (lo que se le manda a Correos): si se cambia algo, cambiarlo en los dos.
export const REMITENTE_CORREOS = {
  nombre: "CHEMASPORT ER SOCIEDAD DE RESPONSABILIDAD LIMITADA",
  telefono: "71103209",
  zip: "20301", // Alajuela, Grecia, Grecia
  correo: "chemasport_er@outlook.com",
  direccion: `Alajuela, Grecia, Grecia, ${DIRECCION_TIENDA}`,
};
