const fs = require('fs');
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

[[30, 'rice-1', 'k-rice-0001'], [20, 'rice-2', 'k-rice-0002'], [10, 'rice-3', 'k-rice-0003']].forEach(
  ([days, name, key]) =>
    fs.writeFileSync(`${name}.json`, JSON.stringify({ idempotencyKey: key, boughtAt: daysAgo(days) }))
);
console.log('created rice-1.json, rice-2.json, rice-3.json');