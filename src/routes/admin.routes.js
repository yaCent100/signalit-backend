const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const asyncRoute = require('../utils/asyncRoute');

router.get('/', authMiddleware, adminMiddleware, asyncRoute(ctrl.getAll));
router.put('/:id', authMiddleware, adminMiddleware, asyncRoute(ctrl.update));
router.delete('/:id', authMiddleware, adminMiddleware, asyncRoute(ctrl.remove));
router.post('/', authMiddleware, adminMiddleware, asyncRoute(ctrl.create));

module.exports = router;