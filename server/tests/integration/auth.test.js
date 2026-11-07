const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const { connectTestDB, clearDB, closeDB } = require('../helpers/db');
const { registerUser } = require('../helpers/factory');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(closeDB);

const register = (body) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const valid = { name: 'Sri', email: 'sri@test.com', password: 'password123' };

describe('register', () => {
  test('returns a token, normalises the email, never leaks the hash', async () => {
    const res = await register({ ...valid, email: '  Sri@Test.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('sri@test.com');
    expect(res.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  test('8 simultaneous registrations with the same email: exactly one wins', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => register(valid)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(await User.countDocuments()).toBe(1);
  });

  test('rejects a short password, with the failing field named', async () => {
    const res = await register({ ...valid, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });

  test('rejects a password over 72 BYTES even when it is under 72 characters', async () => {
    // 25 euro signs = 25 characters but 75 bytes. bcrypt would silently cut it off.
    const res = await register({ ...valid, password: '€'.repeat(25) });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  test('works, and the email is case-insensitive', async () => {
    await register(valid);
    const res = await login({ email: 'SRI@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('wrong password and unknown email give the SAME message', async () => {
    await register(valid);
    const wrongPassword = await login({ email: valid.email, password: 'nope-nope-nope' });
    const unknownEmail = await login({ email: 'nobody@test.com', password: 'password123' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  test('NoSQL injection in the email field is rejected before reaching the database', async () => {
    await register(valid);
    const res = await login({ email: { $gt: '' }, password: 'whatever' });
    expect(res.status).toBe(400);
  });
});

describe('protected routes', () => {
  test('/me works with a valid token', async () => {
    const user = await registerUser('Sri');
    const res = await request(app).get('/api/auth/me').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  test('rejects a missing header, garbage, and a forged "alg: none" token', async () => {
    const user = await registerUser();
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id })}.`;

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  test('a valid token for a deleted account is rejected', async () => {
    const user = await registerUser();
    await User.deleteMany({});
    expect((await request(app).get('/api/auth/me').set(user.auth)).status).toBe(401);
  });
});