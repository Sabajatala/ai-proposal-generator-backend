const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // We will hash later in production
  role: { type: String, default: 'admin' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);