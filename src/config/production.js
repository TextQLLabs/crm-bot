// Production configuration for Railway deployment

if (process.env.RAILWAY_ENVIRONMENT === 'production') {
  console.log('🚂 Railway production environment detected');
  console.log('📦 Node version:', process.version);
  console.log('💾 Using file-based storage for conversation logging');
}

module.exports = {
  isProduction: process.env.RAILWAY_ENVIRONMENT === 'production',
  nodeVersion: process.version
};