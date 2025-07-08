// Production configuration for Railway deployment

// MongoDB connection optimization for Railway
if (process.env.RAILWAY_ENVIRONMENT === 'production') {
  // Ensure proper MongoDB connection string format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('retryWrites')) {
    // Add retryWrites=true for better reliability
    const separator = process.env.MONGODB_URI.includes('?') ? '&' : '?';
    process.env.MONGODB_URI = process.env.MONGODB_URI + separator + 'retryWrites=true&w=majority';
  }
  
  console.log('🚂 Railway production environment detected');
  console.log('📦 Node version:', process.version);
  console.log('🔌 MongoDB configured:', !!process.env.MONGODB_URI);
}

module.exports = {
  isProduction: process.env.RAILWAY_ENVIRONMENT === 'production',
  nodeVersion: process.version
};