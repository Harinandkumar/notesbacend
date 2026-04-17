const mongoose = require('mongoose');
const Note = require('./models/Note');
require('dotenv').config();

async function fixPublicIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        const notes = await Note.find({});
        console.log(`Found ${notes.length} notes`);
        
        for (let note of notes) {
            // Decode the public ID
            const oldPublicId = note.pdfPublicId;
            const decodedPublicId = decodeURIComponent(oldPublicId);
            
            if (oldPublicId !== decodedPublicId) {
                console.log(`Fixing: ${oldPublicId}`);
                console.log(`To: ${decodedPublicId}`);
                
                note.pdfPublicId = decodedPublicId;
                await note.save();
                console.log('✓ Fixed');
            }
        }
        
        console.log('All public IDs fixed!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixPublicIds();