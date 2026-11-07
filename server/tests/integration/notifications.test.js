const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Notification = require('../../src/models/Notification');
const { runRestockReminders } = require('../../src/jobs/restockReminder.job');
const { connectTestDB, clearDB, closeDB } = require('../helpers/db');
const {
  registerUser, setupHousehold, addItem, buy, tapLow, daysAgo, inbox,
} = require('../helpers/factory');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(closeDB);

// Builds an item whose predicted run-out is "about now": purchases 30, 20 and 10 days ago.
async function itemRunningOutNow(ctx, buyer) {
  const item = await addItem(ctx);
  for (const d of [30, 20, 10]) await buy(ctx, buyer, item.id, { boughtAt: daysAgo(d) });
  return item;
}

describe('"running low" alerts', () => {
  test('the turn person gets YOUR_TURN, others ITEM_LOW, the person who tapped gets nothing', async () => {
    const ctx = await setupHousehold(3);
    const [A, B, C] = ctx.users;
    const item = await addItem(ctx);
    await buy(ctx, A, item.id, { boughtAt: daysAgo(1) }); // turn passes to B

    await tapLow(ctx, C, item.id);

    const forB = (await inbox(B)).body.notifications;
    const forA = (await inbox(A)).body.notifications;
    const forC = (await inbox(C)).body.notifications;
    expect(forB).toHaveLength(1);
    expect(forB[0].type).toBe('YOUR_TURN');
    expect(forA).toHaveLength(1);
    expect(forA[0].type).toBe('ITEM_LOW');
    expect(forA[0].message).toMatch(/marked/);
    expect(forC).toHaveLength(0);
  });
});

describe('daily reminder job', () => {
  test('alerts the turn person once, and running it again changes nothing', async () => {
    const ctx = await setupHousehold(3);
    const [A, B] = ctx.users;
    await itemRunningOutNow(ctx, A); // last buyer A -> B's turn

    const first = await runRestockReminders();
    expect(first.created).toBe(1);

    const second = await runRestockReminders();
    expect(second.created).toBe(0);

    const forB = (await inbox(B)).body.notifications;
    expect(forB).toHaveLength(1);
    expect(forB[0].type).toBe('YOUR_TURN');
    expect(forB[0].message).toMatch(/run(ning)? out/);
  });

  test('three runs at the same instant still send exactly one alert', async () => {
    const ctx = await setupHousehold(3);
    const item = await itemRunningOutNow(ctx, ctx.users[0]);

    await Promise.all([runRestockReminders(), runRestockReminders(), runRestockReminders()]);

    expect(await Notification.countDocuments({ item: item.id })).toBe(1);
  });

  test('skips items already marked low and items not running out soon', async () => {
    const ctx = await setupHousehold(3);
    const [A] = ctx.users;

    const lowItem = await itemRunningOutNow(ctx, A);
    await tapLow(ctx, A, lowItem.id);

    const farItem = await addItem(ctx, 'Rice');
    for (const d of [10, 5, 0]) await buy(ctx, A, farItem.id, { boughtAt: daysAgo(d) }); // due in ~5 days

    const result = await runRestockReminders();
    expect(result.created).toBe(0);
  });
});

describe('the inbox', () => {
  async function seed(user, household, count) {
    const docs = Array.from({ length: count }, (_, i) => ({
      user: user.id,
      household: household.id,
      item: new mongoose.Types.ObjectId(),
      type: 'ITEM_LOW',
      message: `m${i + 1}`,
      dedupeKey: `k${i + 1}`,
    }));
    await Notification.insertMany(docs);
  }

  test('paginates newest-first with a cursor, with no repeats and no gaps', async () => {
    const ctx = await setupHousehold(1);
    await seed(ctx.users[0], ctx.household, 3);

    const page1 = (await inbox(ctx.users[0], '?limit=2')).body;
    expect(page1.notifications.map((n) => n.message)).toEqual(['m3', 'm2']);
    expect(page1.nextCursor).toBeTruthy();
    expect(page1.unreadCount).toBe(3);

    const page2 = (await inbox(ctx.users[0], `?limit=2&before=${page1.nextCursor}`)).body;
    expect(page2.notifications.map((n) => n.message)).toEqual(['m1']);
    expect(page2.nextCursor).toBeNull();
  });

  test('mark-read is repeatable, scoped to the owner, and read-all empties the unread list', async () => {
    const ctx = await setupHousehold(2);
    const [me, other] = ctx.users;
    await seed(me, ctx.household, 2);
    const [first] = (await inbox(me)).body.notifications;
    const readUrl = `/api/notifications/${first.id}/read`;

    expect((await request(app).post(readUrl).set(me.auth)).status).toBe(200);
    expect((await request(app).post(readUrl).set(me.auth)).status).toBe(200); // again: harmless
    expect((await request(app).post(readUrl).set(other.auth)).status).toBe(404); // not yours

    const count = await request(app).get('/api/notifications/unread-count').set(me.auth);
    expect(count.body.unreadCount).toBe(1);

    await request(app).post('/api/notifications/read-all').set(me.auth);
    expect((await inbox(me, '?unread=true')).body.notifications).toHaveLength(0);
  });

  test('rejects a silly limit and a malformed cursor', async () => {
    const user = await registerUser();
    expect((await inbox(user, '?limit=999')).status).toBe(400);
    expect((await inbox(user, '?before=nonsense')).status).toBe(400);
  });
});