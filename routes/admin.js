const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const User = require('../models/User');
const Note = require('../models/Note');
const Purchase = require('../models/Purchase');
const Order = require('../models/Order');
const mongoose = require('mongoose');

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
    
    const monthlyRevenue = await Purchase.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: { $month: '$purchasedAt' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    const topSelling = await Purchase.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$noteId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'notes', localField: '_id', foreignField: '_id', as: 'note' } }
    ]);
    
    res.json({
      totalUsers,
      totalNotes,
      totalPurchases,
      totalRevenue: revenue[0]?.total || 0,
      monthlyRevenue,
      topSelling
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
    const orders = await Order.find()
      .populate('userId', 'name email')
      .populate('notes.noteId', 'title')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/orders/:orderId/refund', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Update order status
    order.status = 'refunded';
    order.refundAmount = order.totalAmount;
    order.refundId = `refund_${Date.now()}`;
    await order.save();
    
    // Update purchase status
    await Purchase.updateMany(
      { orderId: order.orderId },
      { status: 'refunded' }
    );
    
    res.json({ message: 'Order refunded successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ NOTES MANAGEMENT (Enhanced) ============
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

router.get('/notes/stats', async (req, res) => {
  try {
    const stats = await Note.aggregate([
      {
        $lookup: {
          from: 'purchases',
          localField: '_id',
          foreignField: 'noteId',
          as: 'sales'
        }
      },
      {
        $project: {
          title: 1,
          price: 1,
          salesCount: { $size: '$sales' },
          totalRevenue: { $sum: '$sales.amount' }
        }
      }
    ]);
    res.json(stats);
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
    
    res.json({
      totalSales: sales.length,
      totalRevenue: total,
      sales
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/reports/download-stats', async (req, res) => {
  try {
    const stats = await Note.aggregate([
      {
        $project: {
          title: 1,
          downloadCount: 1,
          totalEarnings: 1,
          price: 1
        }
      },
      { $sort: { downloadCount: -1 } }
    ]);
    res.json(stats);
  } catch (error) {
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