// Crea (o recrea) el súper usuario.
// Uso:  SEED_SUPERUSER_PASSWORD='una-contraseña-larga' node seedSuperUser.js
//       (opcional) SEED_SUPERUSER_NAME=JuanPa
// La contraseña NO va en el código: este archivo está en git.
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './config/db.js';
import User from './models/User.js';

const USERNAME = process.env.SEED_SUPERUSER_NAME || 'JuanPa';
const PASSWORD = process.env.SEED_SUPERUSER_PASSWORD || '';

if (PASSWORD.length < 10) {
  console.error('❌ Definí SEED_SUPERUSER_PASSWORD con al menos 10 caracteres. Ej:');
  console.error("   SEED_SUPERUSER_PASSWORD='Chema-2026-segura!' node seedSuperUser.js");
  process.exit(1);
}

await connectDB();

try {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ username: USERNAME });

  if (existing) {
    // Conserva el mismo _id (sus tokens/historial siguen asociados) y solo actualiza la contraseña
    existing.password = hashedPassword;
    existing.isSuperUser = true;
    await existing.save();
    console.log(`✅ Contraseña del súper usuario "${USERNAME}" actualizada`);
  } else {
    await User.create({ username: USERNAME, password: hashedPassword, isSuperUser: true, roles: ['add', 'edit', 'delete'] });
    console.log(`✅ Súper usuario "${USERNAME}" creado`);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await mongoose.disconnect();
}
