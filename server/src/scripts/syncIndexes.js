const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

['User', 'Household', 'Item', 'RestockLog', 'Notification', 'JobLock'].forEach((name) =>
  require(`../models/${name}`)
);

(async () => {
  await connectDB();
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes(); // creates missing indexes, drops ones no longer in the schema
    console.log('indexes in sync:', model.modelName);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});