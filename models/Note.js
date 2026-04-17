const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  discountedPrice: { type: Number, default: null }, // Add this
  pdfUrl: { type: String, required: true },
  pdfPublicId: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isFeatured: { type: Boolean, default: false }, // Add this
  downloadCount: { type: Number, default: 0 }, // Add this
  category: { type: String, default: 'General' }, // Add this
  tags: [String], // Add this
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Note', noteSchema);