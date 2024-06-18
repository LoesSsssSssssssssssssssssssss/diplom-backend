const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  role: {
    type: String,
  },
  avatar: {
    type: String,
  },
  phone: {
    type: String,
  },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
