const mongoose = require('mongoose');
const { env } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: 50,                  // max simultaneous DB connections per server instance
    serverSelectionTimeoutMS: 5000,   // fail fast if the DB is unreachable
    // In production, build indexes through a deliberate step, not on every boot.
    autoIndex: env.NODE_ENV !== 'production',
  });

  console.log('MongoDB connected');
}

module.exports = { connectDB };