const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  discountedPrice: { type: Number, default: null }, // New
  pdfUrl: { type: String, required: true },
  pdfPublicId: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isFeatured: { type: Boolean, default: false }, // New
  downloadCount: { type: Number, default: 0 }, // New
  totalEarnings: { type: Number, default: 0 }, // New
  category: { type: String, default: 'General' }, // New
  tags: [String], // New
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', noteSchema);