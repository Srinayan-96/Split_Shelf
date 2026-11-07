const DAY_MS = 24 * 60 * 60 * 1000;

const RECENT_PURCHASES_USED = 7; // look at the last 7 purchases = up to 6 gaps
const MIN_INTERVALS = 2;         // need 2 gaps (3 purchases) before we dare predict
const MIN_VALID_INTERVAL_DAYS = 1; // gaps under a day are "two people bought it
                                   // by mistake", not real consumption: ignore them
const DECAY = 0.7;               // each older gap counts 70% as much as the next newer one

const round2 = (n) => Math.round(n * 100) / 100;

// Input:  purchase dates of ONE item, in any order.
// Output: { avgIntervalDays, predictedRunOutAt, usableGaps }. The first two are
// null if there is too little data; usableGaps says how much data we do have.
function computePrediction(purchaseDates) {
  const times = purchaseDates.map((d) => new Date(d).getTime()).sort((a, b) => b - a);

  const gaps = [];
  for (let i = 0; i < times.length - 1; i++) {
    const days = (times[i] - times[i + 1]) / DAY_MS;
    if (days >= MIN_VALID_INTERVAL_DAYS) gaps.push(days);
  }

  if (gaps.length < MIN_INTERVALS) {
    return { avgIntervalDays: null, predictedRunOutAt: null, usableGaps: gaps.length };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  gaps.forEach((days, i) => {
    const weight = DECAY ** i;
    weightedSum += days * weight;
    weightTotal += weight;
  });
  const avg = weightedSum / weightTotal;

  return {
    avgIntervalDays: round2(avg),
    predictedRunOutAt: new Date(times[0] + avg * DAY_MS),
    usableGaps: gaps.length,
  };
}

module.exports = { computePrediction, RECENT_PURCHASES_USED, MIN_INTERVALS, DAY_MS };
