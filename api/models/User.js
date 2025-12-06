import mongoose from 'mongoose';


const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },


  password: { type: String, required: true, select: false },


  // Lista de permisos:
  // ejemplo: ['add', 'edit', 'delete', 'history', 'ver_ocultos']
  roles: [{ type: String }],


  // Super usuario (permiso máximo)
  isSuperUser: { type: Boolean, default: false }
});


export default mongoose.model('User', userSchema);
