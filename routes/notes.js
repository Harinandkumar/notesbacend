const express = require('express');
const { body, validationResult } = require('express-validator');
const Note = require('../models/Note');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { upload, uploadPDF } = require('../utils/cloudinary');

const router = express.Router();

// Get all notes (public)
router.get('/', async (req, res) => {
    try {
        const notes = await Note.find().sort({ createdAt: -1 });
        res.json(notes);
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload new note (admin only)
router.post('/upload', 
    authMiddleware,
    adminMiddleware,
    upload.single('pdf'),
    async (req, res) => {
        try {
            console.log('=== UPLOAD REQUEST ===');
            
            // Check file
            if (!req.file) {
                return res.status(400).json({ message: 'PDF file is required' });
            }

            const { title, description, price } = req.body;
            
            // Validate fields
            if (!title || !description || !price) {
                return res.status(400).json({ message: 'All fields are required' });
            }
            
            console.log('Uploading to Cloudinary...');
            
            // Upload to Cloudinary
            const result = await uploadPDF(req.file.buffer, req.file.originalname);
            
            console.log('Cloudinary upload complete');
            
            // Save to database
            const note = new Note({
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price),
                pdfUrl: result.secure_url,
                pdfPublicId: result.public_id,
                uploadedBy: req.userId
            });
            
            await note.save();
            
            console.log('Note saved:', note._id);
            
            res.status(201).json({
                success: true,
                message: 'Note uploaded successfully',
                note: {
                    id: note._id,
                    title: note.title,
                    price: note.price
                }
            });
            
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ 
                success: false,
                message: 'Upload failed: ' + error.message 
            });
        }
    }
);

// Delete note (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        
        await note.deleteOne();
        res.json({ message: 'Note deleted successfully' });
        
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;