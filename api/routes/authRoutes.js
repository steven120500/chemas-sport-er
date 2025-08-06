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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Correo inválido",
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
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error al registrar el usuario' });
  }
});

export default router;