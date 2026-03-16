const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: String,
  logoUrl: String,
  skills: [String],
  teamSize: Number,
  experience: Number,
  description: String,
  specialization: String
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);