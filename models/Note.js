const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  pdfUrl: {
    type: String,
    default: ''  // 🔴 TEMPORARY FIX - Cloudinary se pehle
  },
  pdfPublicId: {
    type: String,
    default: ''  // 🔴 TEMPORARY FIX - Cloudinary se pehle
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Note', noteSchema);