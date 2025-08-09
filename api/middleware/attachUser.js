// api/middlewares/attachUser.js
import jwt from 'jsonwebtoken';

export default function attachUser(req, _res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      // asegúrate de firmar name/email en tu token al hacer login
      req.user = { id: payload.id, name: payload.name, email: payload.email };
    } catch (_) {}
  }

  // respaldo por si no hay JWT o falta name
  if (!req.user?.name && req.headers['x-user']) {
    req.user = { ...(req.user || {}), name: req.headers['x-user'] };
  }

  next();
}