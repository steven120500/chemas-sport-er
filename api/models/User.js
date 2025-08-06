import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/.+\@.+\..+/, 'Por favor ingrese un correo válido']
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  roles: [{
    type: String
    // Ejemplo: ['admin', 'agregar_producto', 'ver_pedidos']
  }],
  isSuperUser: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model('User', userSchema);