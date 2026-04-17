// ⚠️ IMPORTANT: Load environment variables FIRST - Before anything else
const dotenv = require('dotenv');
const path = require('path');

// Force load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug: Check if loaded (remove after testing)
console.log('=== ENV LOAD CHECK ===');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || '❌ NOT LOADED');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✅ LOADED' : '❌ NOT LOADED');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ LOADED' : '❌ NOT LOADED');
console.log('MongoDB URI:', process.env.MONGODB_URI ? '✅ LOADED' : '❌ NOT LOADED');
console.log('JWT Secret:', process.env.JWT_SECRET ? '✅ LOADED' : '❌ NOT LOADED');
console.log('Razorpay Key:', process.env.RAZORPAY_KEY_ID ? '✅ LOADED' : '❌ NOT LOADED');
console.log('Admin Email:', process.env.ADMIN_EMAIL || '❌ NOT LOADED');
console.log('=====================');

// Now import other modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'https://notesbacend.onrender.com',
        'https://your-frontend.vercel.app'  // Add your frontend URL
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== IMPORT ROUTES ==========
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const paymentRoutes = require('./routes/payment');
const downloadRoutes = require('./routes/download');
const adminRoutes = require('./routes/admin');

// ========== ROOT ROUTE ==========
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Notes Selling API is running!',
        status: 'active',
        timestamp: new Date().toISOString(),
        endpoints: {
            'API Root': '/api',
            'Authentication': {
                'Signup': 'POST /api/auth/signup',
                'Login': 'POST /api/auth/login',
                'Get User': 'GET /api/auth/me'
            },
            'Notes': {
                'Get All Notes': 'GET /api/notes',
                'Get Single Note': 'GET /api/notes/:id',
                'Upload Note': 'POST /api/notes/upload (Admin)',
                'Delete Note': 'DELETE /api/notes/:id (Admin)'
            },
            'Payment': {
                'Create Order': 'POST /api/payment/create-order',
                'Verify Payment': 'POST /api/payment/verify',
                'My Purchases': 'GET /api/payment/my-purchases'
            },
            'Download': {
                'Get Secure Download': 'GET /api/download/:noteId'
            },
            'Admin': {
                'Dashboard Stats': 'GET /api/admin/stats',
                'Users': 'GET /api/admin/users',
                'Orders': 'GET /api/admin/orders',
                'Reports': 'GET /api/admin/reports/sales'
            }
        }
    });
});

// API Info Route
app.get('/api', (req, res) => {
    res.json({
        message: 'Notes Selling API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            notes: '/api/notes',
            payment: '/api/payment',
            download: '/api/download',
            admin: '/api/admin'
        }
    });
});

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========== ACTUAL API ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/admin', adminRoutes);

// ========== SERVE STATIC FILES (Production) ==========
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}

// ========== MONGODB CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 1000,
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);
    
    // Create default admin if not exists
    createDefaultAdmin();
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Please check your MONGODB_URI in .env file');
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
            console.log('✅ Default admin created successfully');
            console.log(`📧 Email: ${adminEmail}`);
            console.log(`🔑 Password: ${adminPassword}`);
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
    }
}

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`,
        suggestion: 'Check the API endpoints listed at GET /'
    });
});

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}/api`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Admin API: http://localhost:${PORT}/api/admin`);
    console.log('\n✅ Ready to accept requests!\n');
});