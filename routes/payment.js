const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Purchase = require('../models/Purchase');
const Note = require('../models/Note');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { noteId } = req.body;
    
    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    // Check if already purchased
    const existingPurchase = await Purchase.findOne({
      userId: req.userId,
      noteId: noteId,
      status: 'completed'
    });
    
    if (existingPurchase) {
      return res.status(400).json({ message: 'You have already purchased this note' });
    }
    
    const options = {
      amount: Math.round(note.price * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1
    };
    
    const order = await razorpay.orders.create(options);
    
    const purchase = new Purchase({
      userId: req.userId,
      noteId: noteId,
      orderId: order.id,
      amount: note.price,
      status: 'pending'
    });
    
    await purchase.save();
    
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      noteTitle: note.title
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
});

// Verify payment
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { orderId, paymentId, signature, noteId } = req.body;
    
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
    
    if (expectedSignature !== signature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }
    
    const purchase = await Purchase.findOne({ orderId: orderId });
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    purchase.paymentId = paymentId;
    purchase.status = 'completed';
    await purchase.save();
    
    res.json({
      success: true,
      message: 'Payment verified successfully'
    });
    
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: 'Error verifying payment' });
  }
});

// Get user purchases
router.get('/my-purchases', authMiddleware, async (req, res) => {
  try {
    const purchases = await Purchase.find({ 
      userId: req.userId,
      status: 'completed'
    }).populate('noteId');
    
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;