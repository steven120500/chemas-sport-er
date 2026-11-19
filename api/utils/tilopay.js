// utils/tilopay.js
// 💳 Cliente mínimo de Tilopay (página de pago alojada). Docs: https://tilopay.com/en/developers/api
// Llaves SOLO en el entorno (api/.env / Render): TILOPAY_API_USER, TILOPAY_API_PASSWORD, TILOPAY_API_KEY.
// Flujo: login → processPayment (devuelve la URL de pago) → el cliente vuelve a `redirect`
//        → confirmamos SIEMPRE con consult (nunca confiar en los parámetros de la URL de retorno).

const BASE = (process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1').replace(/\/+$/, '');
const USER = process.env.TILOPAY_API_USER || '';
const PASS = process.env.TILOPAY_API_PASSWORD || '';
const KEY = process.env.TILOPAY_API_KEY || '';

export const tilopayConfigurado = () => Boolean(USER && PASS && KEY);

let tokenCache = { token: '', exp: 0 };

async function pedir(path, body, { conToken = true, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (conToken) headers.Authorization = `bearer ${await obtenerToken()}`;
    const r = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    const texto = await r.text();
    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      data = { raw: texto };
    }
    if (!r.ok) {
      // Token vencido o inválido: se borra para pedir uno nuevo la próxima vez
      if (r.status === 401) tokenCache = { token: '', exp: 0 };
      const err = new Error(data?.message || data?.error || `Tilopay respondió ${r.status}`);
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function obtenerToken() {
  if (tokenCache.token && tokenCache.exp > Date.now()) return tokenCache.token;
  const data = await pedir('/login', { apiuser: USER, password: PASS }, { conToken: false });
  if (!data?.access_token) throw new Error('Tilopay no devolvió access_token');
  // Vence en `expires_in` segundos (86400); se renueva 10 min antes
  const segundos = Number(data.expires_in) || 3600;
  tokenCache = { token: data.access_token, exp: Date.now() + Math.max(60, segundos - 600) * 1000 };
  return tokenCache.token;
}

/** Crea el cobro y devuelve la URL de la página de pago de Tilopay. */
export async function crearPago({ orderNumber, amount, redirect, cliente, direccion, returnData }) {
  const body = {
    redirect,
    key: KEY,
    amount: Number(amount).toFixed(2),
    currency: 'CRC',
    orderNumber,
    capture: '1',
    subscription: '0',
    platform: 'api',
    billToFirstName: cliente.nombre,
    billToLastName: cliente.apellidos,
    billToAddress: direccion.linea1,
    billToAddress2: direccion.linea2 || '',
    billToCity: direccion.ciudad,
    billToState: direccion.estadoISO,
    billToZipPostCode: direccion.zip || '10101',
    billToCountry: 'CR',
    billToTelephone: cliente.telefono,
    billToEmail: cliente.correo,
    returnData: returnData || '',
    hashVersion: 'V2',
    token_version: 'v2',
  };
  const data = await pedir('/processPayment', body);
  if (!data?.url) {
    const err = new Error(data?.message || 'Tilopay no devolvió la URL de pago');
    err.data = data;
    throw err;
  }
  return data.url;
}

/** Consulta las transacciones de una orden. Devuelve el arreglo `response` (puede venir vacío). */
export async function consultarOrden(orderNumber) {
  const data = await pedir('/consult', { key: KEY, orderNumber: String(orderNumber) });
  return Array.isArray(data?.response) ? data.response : [];
}

// Provincia → código ISO 3166-2:CR (billToState)
export const ISO_PROVINCIA = {
  'San José': 'CR-SJ',
  Alajuela: 'CR-A',
  Cartago: 'CR-C',
  Heredia: 'CR-H',
  Guanacaste: 'CR-G',
  Puntarenas: 'CR-P',
  'Limón': 'CR-L',
};
