const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username wajib diisi'],
        unique: true,
        trim: true,
        minlength: [3, 'Username minimal 3 karakter'],
        maxlength: [20, 'Username maksimal 20 karakter'],
    },
    email: {
        type: String,
        required: [true, 'Email wajib diisi'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Password wajib diisi'],
    },
    photo: {
        type: String,
        default: "" 
     },
    createdAt: {
        type: Date,
        default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);