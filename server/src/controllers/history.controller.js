const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/history.service');
const { feedQuerySchema } = require('../validators/history.validators');

const feed = asyncHandler(async (req, res) => {
  const query = feedQuerySchema.parse(req.query); // a bad query throws ZodError -> 400
  res.json({ success: true, ...(await service.getFeed(req.household, query)) });
});

const people = asyncHandler(async (req, res) => {
  res.json({ success: true, people: await service.getPeople(req.household) });
});

const person = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await service.getPerson(req.household, req.params.userId)) });
});

module.exports = { feed, people, person };
