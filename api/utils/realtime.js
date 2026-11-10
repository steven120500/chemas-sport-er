// utils/realtime.js
// Socket.io: el catálogo público sigue recibiendo los cambios de stock en vivo, pero SIN datos
// internos. Los usuarios logueados (sala "admins", ver server.js) reciben el objeto completo.
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const ADMIN_ROOM = 'admins';

/** Middleware de socket.io: si el cliente manda un token válido, lo une a la sala de admins. */
export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (token && process.env.JWT_SECRET) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const dbUser = await User.findById(payload.id).lean();
      if (dbUser) socket.data.user = { id: String(dbUser._id), name: dbUser.username };
    }
  } catch {
    /* token inválido: queda como cliente público */
  }
  next(); // nunca se rechaza: el público también recibe actualizaciones (versión sin datos internos)
}

export function onSocketConnection(socket) {
  if (socket.data.user) socket.join(ADMIN_ROOM);
}

function publicProduct(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  // eslint-disable-next-line no-unused-vars
  const { _lastEditMeta, lockedBy, lockedAt, popularCountHistory, ...rest } = obj;
  return rest;
}

/** Reemplaza a io.emit('productoActualizado', obj) */
export function emitProductUpdate(io, obj) {
  if (!io || !obj) return;
  io.to(ADMIN_ROOM).emit('productoActualizado', obj);
  io.except(ADMIN_ROOM).emit('productoActualizado', publicProduct(obj));
}
