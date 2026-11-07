const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');

let counter = 0;

async function registerUser(label = 'User') {
  counter += 1; // incremented synchronously, so parallel calls still get unique emails
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: `${label} ${counter}`,
      email: `user${counter}.${Date.now()}@test.com`,
      password: 'password123',
    });
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.user.id,
    name: res.body.user.name,
    auth: { Authorization: `Bearer ${res.body.token}` },
  };
}

// Creates N users and a household. users[0] is the admin. The rest join one by
// one, so join order (and therefore turn order) equals array order.
async function setupHousehold(memberCount = 3) {
  const users = [];
  for (let i = 0; i < memberCount; i++) users.push(await registerUser(`Member${i}`));

  const created = await request(app)
    .post('/api/households')
    .set(users[0].auth)
    .send({ name: 'Flat 4B' });
  const household = created.body.household;

  for (const user of users.slice(1)) {
    const res = await request(app)
      .post('/api/households/join')
      .set(user.auth)
      .send({ inviteCode: household.inviteCode });
    if (res.status !== 200) throw new Error(`join failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { users, household, base: `/api/households/${household.id}/items` };
}

async function addItem(ctx, name = 'Toilet paper') {
  const res = await request(app).post(ctx.base).set(ctx.users[0].auth).send({ name });
  if (res.status !== 201) throw new Error(`addItem failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item;
}

// Each call gets a fresh idempotency key, like a fresh tap in the real app.
const buy = (ctx, user, itemId, body = {}) =>
  request(app)
    .post(`${ctx.base}/${itemId}/bought`)
    .set(user.auth)
    .send({ idempotencyKey: crypto.randomUUID(), ...body });

const tapLow = (ctx, user, itemId) =>
  request(app).post(`${ctx.base}/${itemId}/low`).set(user.auth);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const inbox = (user, query = '') => request(app).get(`/api/notifications${query}`).set(user.auth);

module.exports = { registerUser, setupHousehold, addItem, buy, tapLow, daysAgo, inbox };