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

// ============================================
// COUPON VALIDATION ROUTE
// ============================================

// Validate coupon (public endpoint)
router.post('/validate-coupon', authMiddleware, async (req, res) => {
    try {
        const { code, amount, noteId } = req.body;
        
        if (!code) {
            return res.status(400).json({ success: false, message: 'Coupon code is required' });
        }
        
        const Coupon = require('../models/Coupon');
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Invalid coupon code' });
        }
        
        // Check if user has already purchased this note
        const existingPurchase = await Purchase.findOne({
            userId: req.userId,
            noteId: noteId,
            status: 'completed'
        });
        
        if (existingPurchase) {
            return res.status(400).json({ 
                success: false, 
                message: 'You have already purchased this note. Cannot apply coupon.' 
            });
        }
        
        // Check if user has already used this coupon for a completed purchase
        const couponUsed = await Purchase.findOne({
            userId: req.userId,
            couponCode: code.toUpperCase(),
            status: 'completed'
        });
        
        if (couponUsed) {
            return res.status(400).json({ 
                success: false, 
                message: 'You have already used this coupon for a previous purchase' 
            });
        }
        
        const validation = await coupon.isValid(req.userId, amount, noteId);
        
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }
        
        const discount = coupon.calculateDiscount(amount);
        const finalAmount = amount - discount;
        
        res.json({
            success: true,
            coupon: {
                id: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount: discount,
                finalAmount: finalAmount,
                message: `Coupon applied! You saved ₹${discount}`
            }
        });
    } catch (error) {
        console.error('Coupon validation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create order (with coupon support)
router.post('/create-order', authMiddleware, async (req, res) => {
    try {
        const { noteId, couponCode } = req.body;
        
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
        
        let finalAmount = note.price;
        let appliedCoupon = null;
        let discountAmount = 0;
        
        // Apply coupon if provided
        if (couponCode) {
            const Coupon = require('../models/Coupon');
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
            
            if (coupon) {
                // Check if user already used this coupon for a completed purchase
                const couponUsed = await Purchase.findOne({
                    userId: req.userId,
                    couponCode: couponCode.toUpperCase(),
                    status: 'completed'
                });
                
                if (!couponUsed) {
                    const validation = await coupon.isValid(req.userId, note.price, noteId);
                    if (validation.valid) {
                        discountAmount = coupon.calculateDiscount(note.price);
                        finalAmount = note.price - discountAmount;
                        appliedCoupon = coupon;
                    }
                }
            }
        }
        
        const options = {
            amount: Math.round(finalAmount * 100),
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1
        };
        
        const order = await razorpay.orders.create(options);
        
        // Create pending purchase record
        const purchase = new Purchase({
            userId: req.userId,
            noteId: noteId,
            paymentId: '',
            orderId: order.id,
            amount: finalAmount,
            originalAmount: note.price,
            couponCode: couponCode || null,
            discountAmount: discountAmount,
            status: 'pending'
        });
        
        await purchase.save();
        
        // Increment coupon usage if applied
        if (appliedCoupon) {
            await appliedCoupon.applyCoupon(req.userId);
        }
        
        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            noteTitle: note.title,
            discountAmount: discountAmount,
            finalAmount: finalAmount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating order' });
    }
});

// Verify payment
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const {
            orderId,
            paymentId,
            signature,
            noteId,
            couponCode
        } = req.body;
        
        // Verify signature
        const body = orderId + '|' + paymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        
        if (expectedSignature !== signature) {
            return res.status(400).json({ message: 'Invalid signature' });
        }
        
        // Update purchase record
        const purchase = await Purchase.findOne({ orderId: orderId });
        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }
        
        purchase.paymentId = paymentId;
        purchase.status = 'completed';
        await purchase.save();
        
        res.json({
            success: true,
            message: 'Payment verified successfully',
            purchase: purchase
        });
    } catch (error) {
        console.error(error);
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