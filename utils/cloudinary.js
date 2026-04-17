const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

// Configure Cloudinary (will use env variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Debug log
console.log('Cloudinary configured with:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌'
});

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

const uploadPDF = (fileBuffer, originalName) => {
  return new Promise((resolve, reject) => {
    const cleanName = originalName.replace('.pdf', '').replace(/[^a-zA-Z0-9]/g, '_');
    const publicId = `note_${Date.now()}_${cleanName}`;
    
    console.log('Uploading to Cloudinary...');
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'notes_pdfs',
        public_id: publicId,
        format: 'pdf'
      },
      (error, result) => {
        if (error) {
          console.error('Upload error:', error);
          reject(error);
        } else {
          console.log('Upload success:', result.secure_url);
          resolve(result);
        }
      }
    );
    
    uploadStream.write(fileBuffer);
    uploadStream.end();
  });
};

const generateSignedUrl = async (publicId) => {
  const timestamp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  
  const signature = cloudinary.utils.api_sign_request(
    { 
      timestamp, 
      resource_type: 'raw', 
      public_id: publicId 
    },
    process.env.CLOUDINARY_API_SECRET
  );
  
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}?signature=${signature}&timestamp=${timestamp}`;
};

module.exports = { upload, uploadPDF, generateSignedUrl };