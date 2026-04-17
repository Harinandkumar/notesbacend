const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testCloudinary() {
  try {
    console.log('Testing Cloudinary connection...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
    console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');
    
    // Test upload
    const testBuffer = Buffer.from('Test PDF content');
    
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'test' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(testBuffer);
    });
    
    console.log('✓ Cloudinary working!');
    console.log('Test upload result:', result.secure_url);
    
  } catch (error) {
    console.error('✗ Cloudinary error:', error.message);
    console.error('Please check your credentials in .env file');
  }
}

testCloudinary();