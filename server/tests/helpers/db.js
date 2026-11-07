const mongoose = require('mongoose');

// Load every model so its indexes get built.
require('../../src/models/User');
require('../../src/models/Household');
require('../../src/models/Item');
require('../../src/models/RestockLog');
require('../../src/models/Notification');
require('../../src/models/JobLock');

async function connectTestDB() {
  const uri = process.env.MONGO_URI;
  const dbName = new URL(uri).pathname.slice(1);

  // Safety: clearDB() deletes everything. Refuse to touch a database that isn't clearly a test one.
  if (!dbName.includes('test')) {
    throw new Error(`Refusing to run tests against database "${dbName}" (name must contain "test")`);
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  // The concurrency guarantees ARE the unique indexes, so make sure they exist
  // before any test runs. Otherwise the tests could pass or fail for the wrong reason.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

// Empties every collection but keeps the indexes.
async function clearDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function closeDB() {
  await mongoose.disconnect();
}

module.exports = { connectTestDB, clearDB, closeDB };