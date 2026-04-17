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

// ============ DASHBOARD STATS (FULLY UPDATED) ============
router.get('/stats', async (req, res) => {
    try {
        // Basic stats
        const totalUsers = await User.countDocuments();
        const totalNotes = await Note.countDocuments();
        const totalPurchases = await Purchase.countDocuments({ status: 'completed' });
        
        const revenue = await Purchase.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        // ============================================
        // TOP SELLING NOTES - REAL DATA FROM DATABASE
        // ============================================
        const topSelling = await Purchase.aggregate([
            { $match: { status: 'completed' } },
            { 
                $group: { 
                    _id: '$noteId', 
                    count: { $sum: 1 },
                    revenue: { $sum: '$amount' }
                } 
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { 
                $lookup: { 
                    from: 'notes', 
                    localField: '_id', 
                    foreignField: '_id', 
                    as: 'noteInfo' 
                } 
            },
            { $unwind: { path: '$noteInfo', preserveNullAndEmptyArrays: true } },
            { 
                $project: {
                    title: { $ifNull: ['$noteInfo.title', 'Deleted Note'] },
                    count: 1,
                    revenue: 1,
                    price: { $ifNull: ['$noteInfo.price', 0] }
                }
            }
        ]);
        
        // ============================================
        // MONTHLY REVENUE - LAST 6 MONTHS
        // ============================================
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const monthlyRevenue = await Purchase.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    purchasedAt: { $gte: sixMonthsAgo }
                } 
            },
            {
                $group: {
                    _id: { 
                        month: { $month: '$purchasedAt' },
                        year: { $year: '$purchasedAt' },
                        monthName: {
                            $let: {
                                vars: {
                                    monthsInString: [
                                        "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                                    ]
                                },
                                in: { $arrayElemAt: ["$$monthsInString", { $month: '$purchasedAt' }] }
                            }
                        }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        // Format monthly revenue for chart
        const formattedMonthlyRevenue = monthlyRevenue.map(m => ({
            month: m._id.monthName,
            total: m.total,
            year: m._id.year
        }));
        
        // ============================================
        // RECENT ORDERS
        // ============================================
        const recentOrders = await Purchase.find({ status: 'completed' })
            .populate('userId', 'name email')
            .populate('noteId', 'title')
            .sort({ purchasedAt: -1 })
            .limit(5);
        
        // ============================================
        // SEND RESPONSE
        // ============================================
        res.json({
            success: true,
            totalUsers,
            totalNotes,
            totalPurchases,
            totalRevenue: revenue[0]?.total || 0,
            topSelling: topSelling,           // ← Chart ke liye real data
            monthlyRevenue: formattedMonthlyRevenue,  // ← Revenue chart ke liye
            recentOrders: recentOrders.map(order => ({
                orderId: order.paymentId || order._id,
                userName: order.userId?.name || 'Unknown',
                userEmail: order.userId?.email || '',
                noteTitle: order.noteId?.title || 'Unknown Note',
                amount: order.amount,
                date: order.purchatedAt,
                status: order.status
            }))
        });
        
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message,
            topSelling: [],
            monthlyRevenue: [],
            recentOrders: []
        });
    }
});

// ============ USER MANAGEMENT ============
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Users Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/users/:userId/block', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { isBlocked: true },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, message: 'User blocked successfully', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/users/:userId/unblock', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { isBlocked: false },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, message: 'User unblocked successfully', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/users/:userId/role', async (req, res) => {
    try {
        const { role } = req.body;
        
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }
        
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { role },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, message: 'User role updated', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/users/:userId', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ ORDER MANAGEMENT ============
router.get('/orders', async (req, res) => {
    try {
        const purchases = await Purchase.find({ status: 'completed' })
            .populate('userId', 'name email')
            .populate('noteId', 'title price')
            .sort({ purchasedAt: -1 });
        
        const orders = purchases.map(purchase => ({
            orderId: purchase.paymentId || purchase._id,
            userId: purchase.userId,
            userName: purchase.userId?.name || 'Unknown',
            userEmail: purchase.userId?.email || '',
            notes: [{
                noteId: purchase.noteId?._id,
                title: purchase.noteId?.title || 'Unknown',
                price: purchase.noteId?.price || 0
            }],
            totalAmount: purchase.amount,
            status: purchase.status,
            createdAt: purchase.purchasedAt
        }));
        
        res.json({
            success: true,
            orders: orders
        });
    } catch (error) {
        console.error('Orders Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/orders/:orderId/refund', async (req, res) => {
    try {
        const purchase = await Purchase.findOne({ paymentId: req.params.orderId });
        
        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        if (purchase.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Order cannot be refunded' });
        }
        
        purchase.status = 'refunded';
        await purchase.save();
        
        res.json({ success: true, message: 'Order refunded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ NOTES MANAGEMENT ============
router.get('/notes', async (req, res) => {
    try {
        const notes = await Note.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            notes: notes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/notes/:noteId', async (req, res) => {
    try {
        const { title, description, price, discountedPrice, isFeatured, category, tags } = req.body;
        
        const note = await Note.findByIdAndUpdate(
            req.params.noteId,
            { 
                title, 
                description, 
                price, 
                discountedPrice, 
                isFeatured, 
                category, 
                tags 
            },
            { new: true, runValidators: true }
        );
        
        if (!note) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }
        
        res.json({ success: true, message: 'Note updated successfully', note });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        
        if (!note) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }
        
        res.json({ success: true, message: 'Featured status updated', note });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        
        const formattedSales = sales.map(sale => ({
            orderId: sale.paymentId,
            userId: sale.userId,
            userName: sale.userId?.name || 'Unknown',
            noteId: sale.noteId,
            noteTitle: sale.noteId?.title || 'Unknown',
            amount: sale.amount,
            purchasedAt: sale.purchasedAt
        }));
        
        res.json({
            success: true,
            totalSales: sales.length,
            totalRevenue: total,
            sales: formattedSales
        });
    } catch (error) {
        console.error('Reports Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ SETTINGS ============
router.post('/settings/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        
        const admin = await User.findById(req.userId);
        
        const isMatch = await admin.comparePassword(oldPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Old password is incorrect' });
        }
        
        admin.password = newPassword;
        await admin.save();
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ DASHBOARD SUMMARY (EXTRA) ============
router.get('/summary', async (req, res) => {
    try {
        // Get today's sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySales = await Purchase.aggregate([
            {
                $match: {
                    status: 'completed',
                    purchasedAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    revenue: { $sum: '$amount' }
                }
            }
        ]);
        
        // Get pending orders
        const pendingOrders = await Purchase.countDocuments({ status: 'pending' });
        
        res.json({
            success: true,
            todayRevenue: todaySales[0]?.revenue || 0,
            todayOrders: todaySales[0]?.count || 0,
            pendingOrders: pendingOrders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;