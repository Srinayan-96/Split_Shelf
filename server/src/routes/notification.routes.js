const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.post('/:id/read', ctrl.read);
router.post('/read-all', ctrl.readAll);

module.exports = router;
