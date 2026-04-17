// ⚠️ IMPORTANT: Load environment variables FIRST
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

// Debug
console.log('=== ENV LOAD CHECK ===');
console.log('MongoDB URI:', process.env.MONGODB_URI ? '✅ LOADED' : '❌ NOT LOADED');
console.log('JWT Secret:', process.env.JWT_SECRET ? '✅ LOADED' : '❌ NOT LOADED');
console.log('=====================');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ========== FIXED CORS CONFIGURATION ==========
app.use(cors({
    origin: '*', // Allow all origins for now
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== IMPORT ROUTES ==========
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const paymentRoutes = require('./routes/payment');
const downloadRoutes = require('./routes/download');
const adminRoutes = require('./routes/admin');

// ========== ROOT ROUTES ==========
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Notes Selling API is running!',
        status: 'active',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========== API ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/admin', adminRoutes);

// ========== MONGODB CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
    createDefaultAdmin();
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
});

// ========== CREATE DEFAULT ADMIN ==========
async function createDefaultAdmin() {
    try {
        const User = require('./models/User');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            const admin = new User({
                name: 'Super Admin',
                email: adminEmail,
                password: adminPassword,
                role: 'admin',
                isBlocked: false
            });
            await admin.save();
            console.log('✅ Default admin created');
        }
    } catch (error) {
        console.error('Error creating admin:', error.message);
    }
}

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`
    });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});