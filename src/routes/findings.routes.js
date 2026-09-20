const router = require('express').Router();
const ctrl = require('../controllers/findings.controller');
const commentsCtrl = require('../controllers/comments.controller');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const asyncRoute = require('../utils/asyncRoute');

router.get('/', asyncRoute(ctrl.getAll));
router.get('/:id', asyncRoute(ctrl.getOne));
router.post('/', authMiddleware, upload.single('photo'), asyncRoute(ctrl.create));
router.put('/:id', authMiddleware, asyncRoute(ctrl.update));
router.patch('/:id/status', authMiddleware, asyncRoute(ctrl.updateStatus));

router.get('/:id/comments', asyncRoute(commentsCtrl.getForFinding));
router.post('/:id/comments', authMiddleware, asyncRoute(commentsCtrl.create));

module.exports = router;