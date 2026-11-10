// middleware/auth.js
// Autorización basada en el JWT que entrega /api/auth/login (lo valida attachUser).
// Regla: el backend exige EXACTAMENTE los mismos permisos que ya pide el frontend.

/** Exige una sesión válida (cualquier usuario logueado). */
export function requireAuth(req, res, next) {
  if (req.user?.id) return next();
  return res.status(401).json({ error: 'Necesitás iniciar sesión.', code: 'AUTH_REQUIRED' });
}

/** Exige alguno de los roles indicados. El súper usuario siempre pasa. */
export function requireRole(...roles) {
  const mw = (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Necesitás iniciar sesión.', code: 'AUTH_REQUIRED' });
    }
    if (req.user.isSuperUser) return next();
    const userRoles = req.user.roles || [];
    if (roles.some((r) => userRoles.includes(r))) return next();
    return res.status(403).json({ error: 'No tenés permisos para esta acción.', code: 'FORBIDDEN' });
  };
  Object.defineProperty(mw, 'name', { value: `requireRole(${roles.join('|')})` });
  return mw;
}

/** Solo súper usuario. */
export function requireSuper(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Necesitás iniciar sesión.', code: 'AUTH_REQUIRED' });
  }
  if (req.user.isSuperUser) return next();
  return res.status(403).json({ error: 'Solo el súper usuario puede hacer esto.', code: 'FORBIDDEN' });
}

/** ¿El usuario puede ver productos ocultos? (mismo criterio que usaba GET /api/products) */
export function canSeeHidden(user) {
  if (!user?.id) return false;
  const roles = user.roles || [];
  return Boolean(user.isSuperUser || roles.includes('edit') || roles.includes('ver_ocultos'));
}

/**
 * Limitador simple en memoria (sin dependencias): máx. `max` intentos por IP en `windowMs`.
 * Suficiente para frenar fuerza bruta en el login de una sola instancia.
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Demasiados intentos. Probá de nuevo en unos minutos.' } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref?.();

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message, code: 'RATE_LIMITED' });
    }
    next();
  };
}

/** Escapa texto del usuario para usarlo dentro de un RegExp de Mongo (evita ReDoS / inyección de regex). */
export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
