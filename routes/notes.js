const express = require('express');
const { body, validationResult } = require('express-validator');
const Note = require('../models/Note');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { upload, uploadPDF } = require('../utils/cloudinary');
const multer = require('multer');

const router = express.Router();

// Configure multer for multiple files
const uploadMultiple = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Get all notes (public)
router.get('/', async (req, res) => {
    try {
        const notes = await Note.find().sort({ createdAt: -1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single note
router.get('/:id', async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        res.json(note);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload single note (admin only) - UPDATED with subject field
router.post('/upload', 
    authMiddleware, 
    adminMiddleware,
    upload.single('pdf'),
    [
        body('title').trim().notEmpty().withMessage('Title is required'),
        body('description').trim().notEmpty().withMessage('Description is required'),
        body('price').isNumeric().withMessage('Price must be a number'),
        body('subject').optional().trim() // ✅ ADDED subject validation
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'PDF file is required' });
            }

            const { title, description, price, subject } = req.body; // ✅ ADDED subject
            
            const result = await uploadPDF(req.file.buffer, req.file.originalname);
            
            const note = new Note({
                title,
                description,
                price: parseFloat(price),
                subject: subject || 'General', // ✅ ADDED subject field
                pdfUrl: result.secure_url,
                pdfPublicId: result.public_id,
                uploadedBy: req.userId
            });
            
            await note.save();
            
            res.status(201).json({
                message: 'Note uploaded successfully',
                note
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
);

// ============================================
// BATCH UPLOAD - MULTIPLE NOTES AT ONCE (UPDATED with subject)
// ============================================

router.post('/batch-upload',
    authMiddleware,
    adminMiddleware,
    uploadMultiple.array('pdfs', 20),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'No PDF files uploaded' });
            }

            const { titles, descriptions, prices, useFileName, subject } = req.body;
            
            const results = {
                success: [],
                failed: []
            };
            
            const defaultSubject = subject || 'General';
            
            for (let index = 0; index < req.files.length; index++) {
                const file = req.files[index];
                const fileName = file.originalname.replace('.pdf', '').replace(/_/g, ' ');
                
                try {
                    let title;
                    let description;
                    let price;
                    
                    if (useFileName === 'true' || !titles) {
                        title = fileName;
                        description = `Study notes for ${fileName}`;
                        price = 499;
                    } else {
                        title = titles && titles[index] ? titles[index] : fileName;
                        description = descriptions && descriptions[index] ? descriptions[index] : `Study notes for ${title}`;
                        price = prices && prices[index] ? parseFloat(prices[index]) : 499;
                    }
                    
                    const result = await uploadPDF(file.buffer, file.originalname);
                    
                    const note = new Note({
                        title: title,
                        description: description,
                        price: price,
                        subject: defaultSubject, // ✅ ADDED subject field
                        pdfUrl: result.secure_url,
                        pdfPublicId: result.public_id,
                        uploadedBy: req.userId
                    });
                    
                    await note.save();
                    
                    results.success.push({
                        fileName: file.originalname,
                        title: title,
                        id: note._id
                    });
                    
                } catch (error) {
                    results.failed.push({
                        fileName: file.originalname,
                        error: error.message
                    });
                }
            }
            
            res.json({
                success: true,
                message: `Uploaded ${results.success.length} notes successfully`,
                results: results
            });
            
        } catch (error) {
            console.error('Batch upload error:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
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
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// SUBJECT WISE ROUTES
// ============================================

// Get all unique subjects
router.get('/subjects', async (req, res) => {
    try {
        const subjects = await Note.distinct('subject');
        res.json({ success: true, subjects: subjects.filter(s => s) });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get notes by subject
router.get('/subject/:subject', async (req, res) => {
    try {
        const { subject } = req.params;
        const notes = await Note.find({ subject: subject }).sort({ createdAt: -1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;