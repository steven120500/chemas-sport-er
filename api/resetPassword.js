// Cambia la contraseña de un usuario existente (no toca roles ni súper usuario).
// Uso:  RESET_USER=Jose RESET_PASSWORD='nueva-contraseña' node resetPassword.js
// La contraseña NO va en el código: este archivo está en git.
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './config/db.js';
import User from './models/User.js';

const USERNAME = (process.env.RESET_USER || '').trim();
const PASSWORD = process.env.RESET_PASSWORD || '';

if (!USERNAME || PASSWORD.length < 8) {
  console.error('❌ Definí RESET_USER y RESET_PASSWORD (mínimo 8 caracteres). Ej:');
  console.error("   RESET_USER=Jose RESET_PASSWORD='Chema-Jose-2026' node resetPassword.js");
  process.exit(1);
}

await connectDB();

try {
  // 👈 Búsqueda exacta primero; si no, sin distinguir mayúsculas
  let user = await User.findOne({ username: USERNAME });
  if (!user) {
    const escaped = USERNAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    user = await User.findOne({ username: new RegExp(`^${escaped}$`, 'i') });
  }

  if (!user) {
    console.error(`❌ No existe el usuario "${USERNAME}"`);
  } else {
    user.password = await bcrypt.hash(PASSWORD, 10);
    await user.save();
    console.log(`✅ Contraseña de "${user.username}" actualizada`);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await mongoose.disconnect();
}
