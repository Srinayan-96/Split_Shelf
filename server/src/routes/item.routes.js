const router = require('express').Router();
const { requireAdmin } = require('../middleware/householdMember');
const validate = require('../middleware/validate');
const { createItemSchema, boughtSchema } = require('../validators/item.validators');
const ctrl = require('../controllers/item.controller');

// Mounted at /api/households/:householdId/items, behind requireAuth and requireMember.
router.get('/', ctrl.list);
router.post('/', validate(createItemSchema), ctrl.create);
router.get('/:itemId', ctrl.detail);
router.post('/:itemId/low', ctrl.low);
router.post('/:itemId/bought', validate(boughtSchema), ctrl.bought);
router.delete('/:itemId', requireAdmin, ctrl.remove);

module.exports = router;    