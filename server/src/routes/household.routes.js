const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requireMember, requireAdmin } = require('../middleware/householdMember');
const { joinLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const {
  createHouseholdSchema,
  joinHouseholdSchema,
  leaveHouseholdSchema,
} = require('../validators/household.validators');
const ctrl = require('../controllers/household.controller');

router.use(requireAuth); // every household route needs a logged-in user
router.use('/:householdId/items', requireMember, require('./item.routes'));
router.use('/:householdId/history', requireMember, require('./history.routes'));

router.post('/', validate(createHouseholdSchema), ctrl.create);
router.post('/join', joinLimiter, validate(joinHouseholdSchema), ctrl.join);
router.get('/mine', ctrl.mine);

router.post('/:householdId/leave', requireMember, validate(leaveHouseholdSchema), ctrl.leave);
router.post('/:householdId/invite-code', requireMember, requireAdmin, ctrl.regenerateCode);

module.exports = router;    