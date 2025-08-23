import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// Registro de usuario normal (cliente o usuario limitado)
router.post('/register', async (req, res) => {
  console.log('REQ.BODY', req.body);
  const { username, password, roles = [] } = req.body;
  console.log('Roles recibidos:', roles);
  console.log('Username recibido:', username);
  console.log('Password recibido:', password);

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
      roles,
      isSuperUser: false
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
  const { username, password } = req.body;
  console.log('REQ.BODY:', req.body);

  try {
    const user = await User.findOne({ username }).select('+password');
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

    // Éxito: devolvemos info útil
    res.json({
      username: user.username,
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
    const users = await User.find({}, 'username roles isSuperUser');
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;