// models/History.js
// models/History.js
import mongoose from 'mongoose';

const HistorySchema = new mongoose.Schema({
  user: { type: String, required: true },
  action: { type: String, required: true },
  item: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true }, // <-- índice por fecha
  details: mongoose.Schema.Types.Mixed, // opcional para más info o diffs
});

// índice compuesto opcional (user + date) para búsquedas específicas
HistorySchema.index({ user: 1, date: -1 });

export default mongoose.model('History', HistorySchema)