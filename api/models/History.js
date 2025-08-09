import mongoose from "mongoose";

const HistorySchema = new mongoose.Schema({
  user: String,
  action: String,
  item: String,
  details: String,
  date: Date
});

const History = mongoose.model("History", HistorySchema);
export default History;