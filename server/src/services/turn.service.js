const same = (a, b) => String(a) === String(b);

// Round-robin: the turn passes to the member AFTER the buyer, in join order.
// If the buyer isn't in the list (they left), indexOf is -1 and we start from member 0.
function pickNextTurn(memberIds, buyerId) {
  if (memberIds.length === 0) return null;
  const index = memberIds.findIndex((id) => same(id, buyerId));
  return memberIds[(index + 1) % memberIds.length];
}

// The stored nextTurn can go stale: that person may have left since.
// This returns who it is right NOW.
function resolveTurn(storedNextTurn, lastBoughtBy, memberIds) {
  const isMember = (id) => id && memberIds.some((m) => same(m, id));
  if (isMember(storedNextTurn)) return storedNextTurn;
  if (lastBoughtBy) return pickNextTurn(memberIds, lastBoughtBy);
  return null; // nothing bought yet: nobody's turn, anyone can start
}

module.exports = { pickNextTurn, resolveTurn };     