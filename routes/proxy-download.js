const express = require('express');
const axios = require('axios');
const Purchase = require('../models/Purchase');
const Note = require('../models/Note');
const authMiddleware = require('../middleware/auth');
const { generateSignedUrl } = require('../utils/cloudinary');

const router = express.Router();

// Proxy download - Using signed URL
router.get('/:noteId', authMiddleware, async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.userId;
        
        console.log('Proxy download for:', noteId);
        
        // Check purchase
        const purchase = await Purchase.findOne({
            userId: userId,
            noteId: noteId,
            status: 'completed'
        });
        
        if (!purchase) {
            return res.status(403).json({ message: 'Not purchased' });
        }
        
        // Get note
        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        
        // Generate signed URL (valid for 1 hour)
        const signedUrl = await generateSignedUrl(note.pdfPublicId);
        console.log('Signed URL generated');
        
        // Fetch PDF using signed URL
        const response = await axios({
            method: 'get',
            url: signedUrl,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(note.title)}.pdf"`);
        
        // Pipe file to response
        response.data.pipe(res);
        
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ message: 'Download failed: ' + error.message });
    }
});

module.exports = router;