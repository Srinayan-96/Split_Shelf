const router = require('express').Router();
const ctrl = require('../controllers/history.controller');

// Mounted at /api/households/:householdId/history, behind requireAuth and requireMember.
router.get('/feed', ctrl.feed);
router.get('/people', ctrl.people);
router.get('/people/:userId', ctrl.person);

module.exports = router;
