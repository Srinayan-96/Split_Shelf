const RestockLog = require('../models/RestockLog');
const Item = require('../models/Item');
const ApiError = require('../utils/ApiError');
const { loadContext } = require('./item.service');

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PERSON_MAX_LOGS = 500; // one person's detail page never loads more than this

const encodeCursor = (log) => `${log.boughtAt.getTime()}_${log._id}`;

async function itemsById(itemIds) {
  const items = await Item.find({ _id: { $in: itemIds } }).select('name unit').lean();
  return new Map(items.map((i) => [String(i._id), i]));
}

function toPurchase(log, names, items) {
  const item = items.get(String(log.item));
  if (!item) return null;
  return {
    id: log._id,
    item: { id: item._id, name: item.name, unit: item.unit },
    boughtBy: { id: log.boughtBy, name: names.get(String(log.boughtBy)) || 'Former member' },
    boughtAt: log.boughtAt,
    quantity: log.quantity ?? 1,        // purchases made before quantities existed
    pricePaise: log.pricePaise ?? null,
    note: log.note || null,
  };
}

// ---------- FEED: every purchase in the household, newest first ----------
async function getFeed(household, { limit, before }) {
  const filter = { household: household._id };
  if (before) {
    // "Older than the last row I have." The id breaks ties between purchases
    // with the same time, so paging never skips or repeats a row.
    filter.$or = [
      { boughtAt: { $lt: before.at } },
      { boughtAt: before.at, _id: { $lt: before.id } },
    ];
  }

  const logs = await RestockLog.find(filter)
    .sort({ boughtAt: -1, _id: -1 })
    .limit(limit + 1) // one extra row just to learn whether another page exists
    .lean();

  const hasMore = logs.length > limit;
  const page = logs.slice(0, limit);

  const [ctx, items] = await Promise.all([
    loadContext(household),
    itemsById(page.map((l) => l.item)),
  ]);

  return {
    purchases: page.map((l) => toPurchase(l, ctx.names, items)).filter(Boolean),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
  };
}

// ---------- PEOPLE: how many purchases each person made (last 12 months) ----------
async function getPeople(household) {
  const since = new Date(Date.now() - YEAR_MS);

  const [rows, ctx] = await Promise.all([
    RestockLog.aggregate([
      { $match: { household: household._id, boughtAt: { $gte: since } } },
      { $group: { _id: '$boughtBy', purchases: { $sum: 1 }, lastBoughtAt: { $max: '$boughtAt' } } },
    ]),
    loadContext(household),
  ]);

  const stats = new Map(rows.map((r) => [String(r._id), r]));
  const person = (id, name) => ({
    id,
    name,
    purchases: stats.get(String(id))?.purchases ?? 0,
    lastBoughtAt: stats.get(String(id))?.lastBoughtAt ?? null,
  });

  // Current members first (even with 0 purchases), then anyone who left but bought something.
  const people = household.members.map((m) => person(m.user, ctx.names.get(String(m.user)) || 'Member'));
  const memberIds = new Set(household.members.map((m) => String(m.user)));
  rows.forEach((r) => {
    if (!memberIds.has(String(r._id))) people.push(person(r._id, 'Former member'));
  });

  return people.sort((a, b) => b.purchases - a.purchases || a.name.localeCompare(b.name));
}

// ---------- ONE PERSON: what they bought, grouped by item ----------
async function getPerson(household, userId) {
  const since = new Date(Date.now() - YEAR_MS);

  const [logs, ctx] = await Promise.all([
    RestockLog.find({ household: household._id, boughtBy: userId, boughtAt: { $gte: since } })
      .sort({ boughtAt: -1, _id: -1 })
      .limit(PERSON_MAX_LOGS)
      .lean(),
    loadContext(household),
  ]);

  const isMember = ctx.names.has(String(userId));
  if (!isMember && logs.length === 0) throw ApiError.notFound('Person not found');

  const items = await itemsById([...new Set(logs.map((l) => String(l.item)))]);

  // Group the (already newest-first) purchases by item.
  const groups = new Map();
  logs.forEach((log) => {
    const key = String(log.item);
    const item = items.get(key);
    if (!item) return; // Skip purchases of deleted items
    if (!groups.has(key)) {
      groups.set(key, {
        item: { id: item._id, name: item.name, unit: item.unit },
        purchases: [],
      });
    }
    groups.get(key).purchases.push({
      id: log._id,
      boughtAt: log.boughtAt,
      quantity: log.quantity ?? 1,
      pricePaise: log.pricePaise ?? null,
      note: log.note || null,
    });
  });

  const byItem = [...groups.values()]
    .map((g) => ({ ...g, times: g.purchases.length }))
    .sort((a, b) => b.times - a.times || a.item.name.localeCompare(b.item.name));

  return {
    person: { id: userId, name: ctx.names.get(String(userId)) || 'Former member' },
    purchaseCount: logs.length,
    truncated: logs.length === PERSON_MAX_LOGS, // true = there are older ones not shown
    byItem,
  };
}

module.exports = { getFeed, getPeople, getPerson };
