// 🧾 Nombre que sale en "Atendió:" del tiquete según el perfil que vendió
const NOMBRES_ATENDIO = {
  juanpa: "Juan Pa",
  tienda: "Jairo",
  ema: "Emmanuel",
  emma: "Emmanuel",
};

const normalizar = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // 👈 "Juan Pa", "juan_pa" y "JuanPa" → "juanpa"

export const nombreAtendio = (usuario) => NOMBRES_ATENDIO[normalizar(usuario)] || usuario;
