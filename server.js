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
console.log('=====================');

// Now import other modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const paymentRoutes = require('./routes/payment');
const downloadRoutes = require('./routes/download');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/download', downloadRoutes);

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});