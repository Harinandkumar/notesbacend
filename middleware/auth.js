const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        console.log('=== AUTH DEBUG ===');
        console.log('Request URL:', req.url);
        console.log('Request Method:', req.method);
        
        const authHeader = req.header('Authorization');
        console.log('Auth Header present:', authHeader ? 'YES' : 'NO');
        
        if (!authHeader) {
            console.log('ERROR: No Authorization header');
            return res.status(401).json({ message: 'Please authenticate - No token' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded for user:', decoded.userId);
        
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            console.log('ERROR: User not found');
            return res.status(401).json({ message: 'Please authenticate - User not found' });
        }

        // ✅ ADDED: Check if user is blocked
        if (user.isBlocked) {
            console.log('ERROR: User is blocked:', user.email);
            return res.status(403).json({ 
                message: 'Your account has been blocked. Please contact admin for assistance.' 
            });
        }

        console.log('Auth successful for:', user.email);
        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        console.error('=== AUTH ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        res.status(401).json({ message: 'Please authenticate - ' + error.message });
    }
};

module.exports = authMiddleware;