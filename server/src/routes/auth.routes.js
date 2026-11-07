const router = require('express').Router();
const { authLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../validators/auth.validators');
const ctrl = require('../controllers/auth.controller');

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;