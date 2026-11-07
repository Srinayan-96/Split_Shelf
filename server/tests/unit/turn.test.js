const mongoose = require('mongoose');
const { pickNextTurn, resolveTurn } = require('../../src/services/turn.service');

const members = ['A', 'B', 'C'];

describe('pickNextTurn', () => {
  test('passes the turn to the next member in join order', () => {
    expect(pickNextTurn(members, 'A')).toBe('B');
    expect(pickNextTurn(members, 'B')).toBe('C');
  });
  test('wraps around from the last member to the first', () => {
    expect(pickNextTurn(members, 'C')).toBe('A');
  });
  test('starts from the first member if the buyer has left', () => {
    expect(pickNextTurn(members, 'Z')).toBe('A');
  });
  test('a household of one gets its own turn back', () => {
    expect(pickNextTurn(['A'], 'A')).toBe('A');
  });
  test('returns null for an empty household', () => {
    expect(pickNextTurn([], 'A')).toBeNull();
  });
  test('compares ObjectIds and strings correctly', () => {
    const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    expect(String(pickNextTurn(ids, String(ids[0])))).toBe(String(ids[1]));
  });
});

describe('resolveTurn', () => {
  test('keeps the stored turn when that person is still a member', () => {
    expect(resolveTurn('B', 'A', members)).toBe('B');
  });
  test('recomputes from the last buyer when the stored person left', () => {
    expect(resolveTurn('GONE', 'B', members)).toBe('C');
  });
  test('is null when nothing was ever bought', () => {
    expect(resolveTurn(null, null, members)).toBeNull();
  });
});