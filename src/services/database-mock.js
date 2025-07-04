// Mock database service for testing without MongoDB
const interactions = [];
const cache = new Map();
const errors = [];

async function connectDB() {
  console.log('Using in-memory database (MongoDB connection bypassed for testing)');
  return true;
}

async function logInteraction(interaction) {
  interactions.push({
    ...interaction,
    timestamp: new Date()
  });
  console.log('Logged interaction:', interaction.message);
}

async function cacheAttioData(key, data) {
  cache.set(key, {
    data,
    createdAt: new Date()
  });
}

async function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && (new Date() - cached.createdAt) < 300000) { // 5 minutes
    return cached.data;
  }
  return null;
}

async function logError(error, context) {
  errors.push({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    timestamp: new Date()
  });
  console.error('Error logged:', error.message);
}

async function getRecentInteractions(userId, limit = 10) {
  return interactions
    .filter(i => i.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

async function closeDB() {
  console.log('Closed in-memory database');
}

module.exports = {
  connectDB,
  logInteraction,
  cacheAttioData,
  getCachedData,
  logError,
  getRecentInteractions,
  closeDB
};