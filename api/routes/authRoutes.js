import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireRole, rateLimit } from '../middleware/auth.js';

const router = express.Router();

const TOKEN_TTL = '30d';
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// Mensaje único para usuario inexistente o contraseña incorrecta (no revelar cuál fue)
const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

/* ============================ LOGIN ============================ */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }
  if (!process.env.JWT_SECRET) {
    console.error('⚠️  Falta JWT_SECRET en las variables de entorno: no se puede iniciar sesión.');
    return res.status(500).json({ message: 'El servidor no está configurado para iniciar sesión.' });
  }

  try {
    const user = await User.findOne({ username }).select('+password');
    const ok = user ? await bcrypt.compare(password, user.password) : false;
    if (!ok) return res.status(401).json({ message: CREDENCIALES_INVALIDAS });

    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

    res.json({
      token,
      username: user.username,
      roles: user.roles,
      isSuperUser: user.isSuperUser,
    });
  } catch (error) {
    console.error('Error en login:', error?.message || error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

/* ===================== REGISTRAR USUARIO =====================
   Antes era público. Ahora: súper usuario o rol "add" (igual que el botón del menú). */
router.post('/register', requireRole('add'), async (req, res) => {
  const { username, password, roles = [] } = req.body || {};

  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ message: 'Usuario y contraseña (mín. 4 caracteres) son requeridos' });
  }
  const cleanRoles = Array.isArray(roles) ? roles.filter((r) => typeof r === 'string').map((r) => r.trim()).filter(Boolean) : [];

  try {
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) return res.status(400).json({ message: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      username: username.trim(),
      password: hashedPassword,
      roles: cleanRoles,
      isSuperUser: false, // nunca se crea un súper usuario desde la API
    });
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar usuario:', error?.message || error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

/* ======================= LISTAR USUARIOS =======================
   Súper usuario o rol "view_users" (igual que el botón "Ver usuarios"). */
router.get('/users', requireRole('view_users'), async (req, res) => {
  try {
    const users = await User.find({}, 'username roles isSuperUser');
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error?.message || error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

/* ======================= ELIMINAR USUARIO =======================
   Mismas reglas que la interfaz: no se puede borrar a uno mismo ni a un súper usuario. */
router.delete('/users/:id', requireRole('view_users'), async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ message: 'No podés eliminar tu propio usuario' });

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (target.isSuperUser) return res.status(403).json({ message: 'No se puede eliminar un súper usuario' });

    await target.deleteOne();
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error?.message || error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;
