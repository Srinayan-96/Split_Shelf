// Runs before every test file, BEFORE any app code is loaded.
// Tests always use a dedicated database, never your dev data.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/split-shelf-test';
process.env.CRON_ENABLED = 'false';