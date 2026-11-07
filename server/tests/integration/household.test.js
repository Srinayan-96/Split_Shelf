const request = require('supertest');
const app = require('../../src/app');
const Household = require('../../src/models/Household');
const Item = require('../../src/models/Item');
const { connectTestDB, clearDB, closeDB } = require('../helpers/db');
const { registerUser, setupHousehold, addItem } = require('../helpers/factory');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(closeDB);

const create = (user, name = 'Flat 4B') =>
  request(app).post('/api/households').set(user.auth).send({ name });
const join = (user, inviteCode) =>
  request(app).post('/api/households/join').set(user.auth).send({ inviteCode });
const mine = (user) => request(app).get('/api/households/mine').set(user.auth);
const leave = (user, id) => request(app).post(`/api/households/${id}/leave`).set(user.auth);

describe('create and join', () => {
  test('creator becomes admin, code is 8 unambiguous characters, emails are not exposed', async () => {
    const user = await registerUser();
    const res = await create(user);
    expect(res.status).toBe(201);
    expect(res.body.household.members[0].role).toBe('admin');
    expect(res.body.household.inviteCode).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/);
    expect(JSON.stringify(res.body)).not.toMatch(/@/);
  });

  test('one household per user', async () => {
    const user = await registerUser();
    await create(user);
    expect((await create(user, 'Second')).status).toBe(409);
  });

  test('joining works with a lowercase code', async () => {
    const [owner, other] = [await registerUser(), await registerUser()];
    const code = (await create(owner)).body.household.inviteCode;
    const res = await join(other, code.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body.household.members).toHaveLength(2);
  });

  test('unknown code -> 404, malformed code -> 400, already in a household -> 409', async () => {
    const [a, b] = [await registerUser(), await registerUser()];
    await create(a);
    expect((await join(b, 'ABCDEFGH')).status).toBe(404);
    expect((await join(b, 'abc')).status).toBe(400);

    const other = await registerUser();
    const code = (await create(other, 'Other')).body.household.inviteCode;
    expect((await join(a, code)).status).toBe(409);
  });
});

describe('concurrency', () => {
  test('12 people race for 9 free seats: exactly 9 get in, 3 are told it is full', async () => {
    const owner = await registerUser();
    const household = (await create(owner)).body.household;
    const joiners = await Promise.all(Array.from({ length: 12 }, () => registerUser()));

    const results = await Promise.all(joiners.map((u) => join(u, household.inviteCode)));

    const ok = results.filter((r) => r.status === 200);
    const rejected = results.filter((r) => r.status !== 200);
    expect(ok).toHaveLength(9);
    expect(rejected).toHaveLength(3);
    rejected.forEach((r) => {
      expect(r.status).toBe(409);
      expect(r.body.message).toMatch(/full/i);
    });
    expect((await Household.findById(household.id)).members).toHaveLength(10);
  });

  test('one user joining two households at the same instant ends up in exactly one', async () => {
    const [a, b, c] = await Promise.all([registerUser(), registerUser(), registerUser()]);
    const hA = (await create(a)).body.household;
    const hB = (await create(b, 'Other')).body.household;

    const results = await Promise.all([join(c, hA.inviteCode), join(c, hB.inviteCode)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await Household.countDocuments({ 'members.user': c.id })).toBe(1);
  });
});

describe('leaving', () => {
  test('when the only admin leaves, the longest-standing member is promoted', async () => {
    const { users: [admin, member], household } = await setupHousehold(2);
    expect((await leave(admin, household.id)).status).toBe(200);

    const view = (await mine(member)).body.household;
    expect(view.members).toHaveLength(1);
    expect(view.members[0].role).toBe('admin');
    expect((await mine(admin)).body.household).toBeNull();
  });

  test('when the last member leaves, the household and its items are deleted', async () => {
    const ctx = await setupHousehold(1);
    await addItem(ctx);
    expect((await leave(ctx.users[0], ctx.household.id)).status).toBe(200);
    expect(await Household.countDocuments()).toBe(0);
    expect(await Item.countDocuments()).toBe(0);
  });

  test('two members leaving at the same instant leaves no zombie household or orphan items', async () => {
    const ctx = await setupHousehold(2);
    await addItem(ctx);
    const results = await Promise.all(ctx.users.map((u) => leave(u, ctx.household.id)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await Household.countDocuments()).toBe(0);
    expect(await Item.countDocuments()).toBe(0);
  });

  test('outsiders get 404 and a garbage id gets 400', async () => {
    const ctx = await setupHousehold(1);
    const outsider = await registerUser();
    expect((await leave(outsider, ctx.household.id)).status).toBe(404);
    expect((await leave(outsider, 'not-an-id')).status).toBe(400);
  });
});

describe('invite code management', () => {
  test('only an admin can regenerate, and the old code stops working', async () => {
    const { users: [admin, member], household } = await setupHousehold(2);
    const url = `/api/households/${household.id}/invite-code`;

    expect((await request(app).post(url).set(member.auth)).status).toBe(403);

    const res = await request(app).post(url).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.household.inviteCode).not.toBe(household.inviteCode);

    const newcomer = await registerUser();
    expect((await join(newcomer, household.inviteCode)).status).toBe(404);
    expect((await join(newcomer, res.body.household.inviteCode)).status).toBe(200);
  });
});