import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  roles: [{ type: String }], // Ej: ['admin', 'agregar_producto', 'ver_pedidos']
  isSuperUser: { type: Boolean, default: false } // Solo uno debe tener true
})

export default mongoose.model('User', userSchema);