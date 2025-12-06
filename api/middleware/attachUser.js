import jwt from "jsonwebtoken";
import User from "../models/User.js";


export default async function attachUser(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;


  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);


      // Buscar el usuario REAL en la base de datos
      const dbUser = await User.findById(payload.id).lean();


      if (dbUser) {
        req.user = {
          id: dbUser._id,
          name: dbUser.username,
          email: dbUser.email,
          roles: dbUser.roles || [],
          isSuperUser: dbUser.isSuperUser || false,
        };
      } else {
        req.user = { id: payload.id, name: payload.name, email: payload.email };
      }
    } catch (err) {
      console.error("JWT inválido:", err);
    }
  }


  // respaldo si no hay token pero viene x-user (caso local/test)
  if (!req.user?.name && req.headers["x-user"]) {
    req.user = { ...(req.user || {}), name: req.headers["x-user"] };
  }


  next();
}
