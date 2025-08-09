// models/History.js
import mongoose from 'mongoose';
const HistorySchema = new mongoose.Schema({
  user: String,
  action: String,
  item: String,
  date: { type: Date, default: Date.now },
  details: mongoose.Schema.Types.Mixed, // <--- opcional/diff
});
export default mongoose.model('History', HistorySchema);