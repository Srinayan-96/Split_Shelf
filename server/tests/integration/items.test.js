const request = require('supertest');
const app = require('../../src/app');
const Item = require('../../src/models/Item');
const RestockLog = require('../../src/models/RestockLog');
const Notification = require('../../src/models/Notification');
const { connectTestDB, clearDB, closeDB } = require('../helpers/db');
const {
  registerUser, setupHousehold, addItem, buy, tapLow, daysAgo,
} = require('../helpers/factory');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(closeDB);

describe('adding items', () => {
  test('rejects a duplicate name in any casing, and an empty name', async () => {
    const ctx = await setupHousehold(2);
    await addItem(ctx, 'Dish soap');
    const dup = await request(app).post(ctx.base).set(ctx.users[1].auth).send({ name: '  dish SOAP ' });
    expect(dup.status).toBe(409);
    const empty = await request(app).post(ctx.base).set(ctx.users[0].auth).send({ name: '   ' });
    expect(empty.status).toBe(400);
  });

  test('5 simultaneous adds of the same name: exactly one wins', async () => {
    const ctx = await setupHousehold(3);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app).post(ctx.base).set(ctx.users[i % 3].auth).send({ name: 'Cooking oil' })
      )
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await Item.countDocuments()).toBe(1);
  });
});

describe('isolation between households', () => {
  test('an outsider cannot list or read items', async () => {
    const ctx = await setupHousehold(2);
    const item = await addItem(ctx);
    const outsider = await registerUser();
    expect((await request(app).get(ctx.base).set(outsider.auth)).status).toBe(404);
    expect((await request(app).get(`${ctx.base}/${item.id}`).set(outsider.auth)).status).toBe(404);
  });

  test("household A cannot reach household B's item through A's own URL", async () => {
    const ctxA = await setupHousehold(1);
    const ctxB = await setupHousehold(1);
    const itemB = await addItem(ctxB);
    const res = await request(app).get(`${ctxA.base}/${itemB.id}`).set(ctxA.users[0].auth);
    expect(res.status).toBe(404);
    const low = await tapLow(ctxA, ctxA.users[0], itemB.id);
    expect(low.status).toBe(404);
  });
});

describe('running low', () => {
  test('6 taps from 3 people at once: one status change, no duplicate alerts', async () => {
    const ctx = await setupHousehold(3);
    const item = await addItem(ctx);

    const results = await Promise.all(
      [...ctx.users, ...ctx.users].map((u) => tapLow(ctx, u, item.id))
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.changed)).toHaveLength(1);
    // 3 members minus the person who tapped = exactly 2 alerts
    expect(await Notification.countDocuments({ item: item.id })).toBe(2);
  });

  test('unknown item -> 404, malformed id -> 400', async () => {
    const ctx = await setupHousehold(1);
    const unknown = await tapLow(ctx, ctx.users[0], '64b7f0f0f0f0f0f0f0f0f0f0');
    expect(unknown.status).toBe(404);
    const malformed = await tapLow(ctx, ctx.users[0], 'abc');
    expect(malformed.status).toBe(400);
  });
});

describe('"I bought this"', () => {
  test('the same idempotency key sent 5 times at once = ONE purchase', async () => {
    const ctx = await setupHousehold(2);
    const item = await addItem(ctx);
    const key = 'tap-key-12345678';

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(`${ctx.base}/${item.id}/bought`).set(ctx.users[0].auth).send({ idempotencyKey: key })
      )
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.replayed === false)).toHaveLength(1);
    expect(await RestockLog.countDocuments({ item: item.id })).toBe(1);
  });

  test('the item follows the LATER purchase, whichever request arrives last', async () => {
    const ctx = await setupHousehold(3);
    const item = await addItem(ctx);

    await buy(ctx, ctx.users[1], item.id, { boughtAt: daysAgo(1) }); // newer, arrives first
    await buy(ctx, ctx.users[2], item.id, { boughtAt: daysAgo(2) }); // older, arrives second

    const detail = await request(app).get(`${ctx.base}/${item.id}`).set(ctx.users[0].auth);
    expect(detail.body.item.lastBoughtBy.id).toBe(ctx.users[1].id);
    expect(detail.body.history).toHaveLength(2); // both are kept as history
  });

  test('a prediction appears after the third purchase, not before', async () => {
    const ctx = await setupHousehold(2);
    const item = await addItem(ctx);
    const me = ctx.users[0];

    await buy(ctx, me, item.id, { boughtAt: daysAgo(30) });
    const second = await buy(ctx, me, item.id, { boughtAt: daysAgo(20) });
    expect(second.body.item.avgIntervalDays).toBeNull();

    const third = await buy(ctx, me, item.id, { boughtAt: daysAgo(10) });
    expect(third.body.item.avgIntervalDays).toBeCloseTo(10, 1);
    const offBy = Math.abs(new Date(third.body.item.predictedRunOutAt) - Date.now());
    expect(offBy).toBeLessThan(24 * 60 * 60 * 1000);
  });

  test('buying clears the low status and marks stale alerts as read', async () => {
    const ctx = await setupHousehold(3);
    const item = await addItem(ctx);
    await tapLow(ctx, ctx.users[0], item.id);
    expect(await Notification.countDocuments({ item: item.id, readAt: null })).toBe(2);

    const res = await buy(ctx, ctx.users[1], item.id);
    expect(res.body.item.status).toBe('ok');
    expect(res.body.item.lowMarkedBy).toBeNull();
    expect(await Notification.countDocuments({ item: item.id, readAt: null })).toBe(0);
  });

  test('validation: future date, too-old date, missing or short key', async () => {
    const ctx = await setupHousehold(1);
    const item = await addItem(ctx);
    const me = ctx.users[0];
    const post = (body) =>
      request(app).post(`${ctx.base}/${item.id}/bought`).set(me.auth).send(body);

    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect((await post({ idempotencyKey: 'key-12345678', boughtAt: future })).status).toBe(400);
    expect((await post({ idempotencyKey: 'key-12345678', boughtAt: daysAgo(800) })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ idempotencyKey: 'short' })).status).toBe(400);
  });
});

describe('whose turn', () => {
  test('passes round-robin and wraps around', async () => {
    const ctx = await setupHousehold(3);
    const [A, B, C] = ctx.users;
    const item = await addItem(ctx);

    expect((await buy(ctx, A, item.id, { boughtAt: daysAgo(3) })).body.item.nextTurn.id).toBe(B.id);
    expect((await buy(ctx, B, item.id, { boughtAt: daysAgo(2) })).body.item.nextTurn.id).toBe(C.id);
    expect((await buy(ctx, C, item.id, { boughtAt: daysAgo(1) })).body.item.nextTurn.id).toBe(A.id);
  });

  test('if the next person leaves, the turn moves on; a leaver shows as "Former member"', async () => {
    const ctx = await setupHousehold(3);
    const [A, B, C] = ctx.users;
    const item = await addItem(ctx);
    await buy(ctx, A, item.id); // turn passes to B

    await request(app).post(`/api/households/${ctx.household.id}/leave`).set(B.auth);
    const list = await request(app).get(ctx.base).set(C.auth);
    expect(list.body.items[0].nextTurn.id).toBe(C.id);

    await request(app).post(`/api/households/${ctx.household.id}/leave`).set(A.auth);
    const after = await request(app).get(ctx.base).set(C.auth);
    expect(after.body.items[0].lastBoughtBy.name).toBe('Former member');
  });
});

describe('deleting an item', () => {
  test('only an admin can, and its history goes with it', async () => {
    const ctx = await setupHousehold(2);
    const item = await addItem(ctx);
    await buy(ctx, ctx.users[0], item.id);

    const asMember = await request(app).delete(`${ctx.base}/${item.id}`).set(ctx.users[1].auth);
    expect(asMember.status).toBe(403);

    const asAdmin = await request(app).delete(`${ctx.base}/${item.id}`).set(ctx.users[0].auth);
    expect(asAdmin.status).toBe(200);
    expect(await Item.countDocuments()).toBe(0);
    expect(await RestockLog.countDocuments()).toBe(0);
  });
});