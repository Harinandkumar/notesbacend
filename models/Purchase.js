const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  noteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    required: true
  },
  paymentId: {
    type: String,
    default: '',  // 🔴 YAHAN CHANGE KIYA (required hata diya)
    sparse: true
  },
  orderId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  purchasedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a user can only purchase a note once
purchaseSchema.index({ userId: 1, noteId: 1 }, { unique: true });

module.exports = mongoose.model('Purchase', purchaseSchema);