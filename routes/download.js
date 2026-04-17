const express = require('express');
const Purchase = require('../models/Purchase');
const Note = require('../models/Note');
const authMiddleware = require('../middleware/auth');
const { generateSignedUrl } = require('../utils/cloudinary');

const router = express.Router();

// Secure download - Only purchased users with signed URLs
router.get('/:noteId', authMiddleware, async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.userId;
        
        console.log('Secure download request for:', noteId);
        
        // Check if user purchased
        const purchase = await Purchase.findOne({
            userId: userId,
            noteId: noteId,
            status: 'completed'
        });
        
        if (!purchase) {
            return res.status(403).json({ 
                success: false,
                message: 'You have not purchased this note' 
            });
        }
        
        // Get note
        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ 
                success: false,
                message: 'Note not found' 
            });
        }
        
        // Generate signed URL (24 hours valid)
        const signedUrl = await generateSignedUrl(note.pdfPublicId);
        
        // Return signed URL
        res.json({
            success: true,
            downloadUrl: signedUrl,
            expiresIn: '24 hours',
            noteTitle: note.title
        });
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Download failed. Please try again.' 
        });
    }
});

module.exports = router;