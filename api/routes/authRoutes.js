import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// Registro de usuario normal (cliente o usuario limitado)
router.post('/register', async (req, res) => {
  console.log("REQ.BODY:", req.body);
  const { email, password, roles = [] } = req.body;
  console.log("Email recibido:", email);
  console.log("Password recibido:", password);
  console.log("Roles recibidos:", roles);

  // Validación básica de contraseña
  const passwordRegex = /^[A-Za-z0-9]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: "La contraseña debe tener al menos 8 caracteres, solo requiere numeros y letras",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
      roles,
      isSuperUser: false,
    });

    await newUser.save();
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log("REQ.BODY:", req.body);

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

    // Éxito: devolvemos info útil
    res.json({
      email: user.email,
      roles: user.roles,
      isSuperUser: user.isSuperUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// Obtener todos los usuarios (sin contraseñas)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email roles isSuperUser');
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

export default router;