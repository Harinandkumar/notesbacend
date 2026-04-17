const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const User = require('../models/User');
const Note = require('../models/Note');
const Purchase = require('../models/Purchase');
const Order = require('../models/Order');

// All routes require admin authentication
router.use(authMiddleware, adminMiddleware);

// ============ DASHBOARD STATS ============
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalNotes = await Note.countDocuments();
        const totalPurchases = await Purchase.countDocuments({ status: 'completed' });
        
        const revenue = await Purchase.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        res.json({
            totalUsers,
            totalNotes,
            totalPurchases,
            totalRevenue: revenue[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ USER MANAGEMENT ============
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/users/:userId/block', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { isBlocked: true },
            { new: true }
        ).select('-password');
        res.json({ message: 'User blocked successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/users/:userId/unblock', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { isBlocked: false },
            { new: true }
        ).select('-password');
        res.json({ message: 'User unblocked successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/users/:userId/role', async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { role },
            { new: true }
        ).select('-password');
        res.json({ message: 'User role updated', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.delete('/users/:userId', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.userId);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ ORDER MANAGEMENT ============
router.get('/orders', async (req, res) => {
    try {
        // Get all purchases with populated data
        const purchases = await Purchase.find({ status: 'completed' })
            .populate('userId', 'name email')
            .populate('noteId', 'title price')
            .sort({ purchasedAt: -1 });
        
        // Transform to order format
        const orders = purchases.map(purchase => ({
            orderId: purchase.paymentId || purchase._id,
            userId: purchase.userId,
            notes: [purchase.noteId],
            totalAmount: purchase.amount,
            status: purchase.status,
            createdAt: purchase.purchasedAt
        }));
        
        res.json(orders);
    } catch (error) {
        console.error('Error in /orders:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/orders/:orderId/refund', async (req, res) => {
    try {
        const purchase = await Purchase.findOne({ paymentId: req.params.orderId });
        if (!purchase) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        purchase.status = 'refunded';
        await purchase.save();
        
        res.json({ message: 'Order refunded successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ NOTES MANAGEMENT ============
router.put('/notes/:noteId', async (req, res) => {
    try {
        const { title, description, price, discountedPrice, isFeatured, category, tags } = req.body;
        const note = await Note.findByIdAndUpdate(
            req.params.noteId,
            { title, description, price, discountedPrice, isFeatured, category, tags },
            { new: true }
        );
        res.json({ message: 'Note updated successfully', note });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/notes/:noteId/featured', async (req, res) => {
    try {
        const { isFeatured } = req.body;
        const note = await Note.findByIdAndUpdate(
            req.params.noteId,
            { isFeatured },
            { new: true }
        );
        res.json({ message: 'Featured status updated', note });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ REPORTS ============
router.get('/reports/sales', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { status: 'completed' };
        
        if (startDate && endDate) {
            query.purchasedAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const sales = await Purchase.find(query)
            .populate('userId', 'name email')
            .populate('noteId', 'title price')
            .sort({ purchasedAt: -1 });
        
        const total = sales.reduce((sum, sale) => sum + sale.amount, 0);
        
        // Transform to match frontend expectations
        const formattedSales = sales.map(sale => ({
            orderId: sale.paymentId,
            userId: sale.userId,
            noteId: sale.noteId,
            amount: sale.amount,
            purchasedAt: sale.purchasedAt
        }));
        
        res.json({
            totalSales: sales.length,
            totalRevenue: total,
            sales: formattedSales
        });
    } catch (error) {
        console.error('Error in reports/sales:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============ SETTINGS ============
router.post('/settings/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const admin = await User.findById(req.userId);
        
        const isMatch = await admin.comparePassword(oldPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Old password is incorrect' });
        }
        
        admin.password = newPassword;
        await admin.save();
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;