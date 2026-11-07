const { computePrediction, DAY_MS } = require('../../src/services/prediction.service');

const START = Date.UTC(2026, 0, 1);
const day = (n) => new Date(START + n * DAY_MS); // n days after a fixed starting point

describe('computePrediction', () => {
  test('returns nulls when there is no data', () => {
    expect(computePrediction([])).toMatchObject({ avgIntervalDays: null, predictedRunOutAt: null });
  });

  test('purchases on the same day give no usable gaps', () => {
    const result = computePrediction([day(0), day(0.1), day(0.2)]);
    expect(result.usableGaps).toBe(0);
    expect(result.avgIntervalDays).toBeNull();
  });

  test('returns nulls with fewer than 2 usable gaps (2 purchases = 1 gap)', () => {
    expect(computePrediction([day(0), day(10)]).avgIntervalDays).toBeNull();
  });

  test('worked example: gaps 10, 11, 9 -> about 9.86 days', () => {
    const result = computePrediction([day(0), day(10), day(21), day(30)]);
    expect(result.avgIntervalDays).toBeCloseTo(9.86, 2);
    const expected = day(30).getTime() + 9.863 * DAY_MS;
    expect(Math.abs(result.predictedRunOutAt.getTime() - expected)).toBeLessThan(60 * 1000);
  });

  test('does not depend on the order the dates are given in', () => {
    const a = computePrediction([day(0), day(10), day(21), day(30)]);
    const b = computePrediction([day(30), day(0), day(21), day(10)]);
    expect(b).toEqual(a);
  });

  test('ignores gaps under one day (two people bought the same thing by mistake)', () => {
    const result = computePrediction([day(0), day(10), day(10.2), day(20)]);
    expect(result.avgIntervalDays).toBeCloseTo(9.88, 2); // gaps 9.8 and 10
  });

  test('recent gaps count more than old ones', () => {
    // gaps newest-first: 5, 10, 20, 20. A plain average would be 13.75.
    const result = computePrediction([day(0), day(20), day(40), day(50), day(55)]);
    expect(result.avgIntervalDays).toBeLessThan(13.75);
    expect(result.avgIntervalDays).toBeGreaterThan(5);
    expect(result.avgIntervalDays).toBeCloseTo(11.31, 2);
  });

  test('a perfectly regular habit predicts exactly that interval', () => {
    const result = computePrediction([day(0), day(7), day(14), day(21)]);
    expect(result.avgIntervalDays).toBe(7);
    expect(result.predictedRunOutAt.getTime()).toBe(day(28).getTime());
  });

  test('accepts ISO strings as well as Date objects', () => {
    const result = computePrediction([
      '2026-01-01T00:00:00Z',
      '2026-01-11T00:00:00Z',
      '2026-01-21T00:00:00Z',
    ]);
    expect(result.avgIntervalDays).toBe(10);
  });
});