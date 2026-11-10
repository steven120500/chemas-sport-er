import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Lee el JWT del header Authorization ("Bearer <token>") y, si es válido y el usuario
 * sigue existiendo, deja en req.user: { id, name, roles, isSuperUser }.
 * Sin token (o token inválido/expirado) la petición sigue como anónima: cada ruta decide
 * con requireAuth / requireRole si la acepta.
 *
 * ⚠️ Los headers x-super / x-admin / x-roles que manda el frontend viejo YA NO dan permisos.
 */
export default async function attachUser(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const dbUser = await User.findById(payload.id).lean();
      if (dbUser) {
        req.user = {
          id: String(dbUser._id),
          name: dbUser.username,
          roles: dbUser.roles || [],
          isSuperUser: dbUser.isSuperUser || false,
        };
      }
    } catch (err) {
      // token vencido o alterado: se trata como anónimo (sin volcar el error completo en los logs)
      if (err?.name !== "TokenExpiredError") console.warn("JWT inválido:", err?.name || "error");
    }
  }

  next();
}
