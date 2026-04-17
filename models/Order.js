const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: [{
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
    price: Number,
    title: String
  }],
  totalAmount: { type: Number, required: true },
  paymentId: String,
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'refunded', 'failed'],
    default: 'pending'
  },
  refundId: String,
  refundAmount: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);