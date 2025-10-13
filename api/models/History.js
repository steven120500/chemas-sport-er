import mongoose from 'mongoose';

const HistorySchema = new mongoose.Schema({
  user:   { type: String, required: true },
  action: { type: String, required: true },
  item:   { type: String, required: true },
  date:   { type: Date, default: Date.now, index: true }, // índice por fecha

  // 🟡 Antes: Mixed. Ahora garantizamos que si llega un array se guarda como string legible
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: '',
    set: (val) => {
      if (Array.isArray(val)) return val.join(' | ');
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    },
  },
});

// Índice compuesto opcional (user + date) para búsquedas específicas
HistorySchema.index({ user: 1, date: -1 });

export default mongoose.model('History', HistorySchema);
