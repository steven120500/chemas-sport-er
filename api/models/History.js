const mongoose = require("mongoose");

const HistorySchema = new mongoose.Schema({
  user: String,
  action: String,
  item: String,
  date: Date
});

module.exports = mongoose.model("History", HistorySchema);