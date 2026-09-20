const commentsCtrl = require('../controllers/comments.controller');

router.get('/:id/comments', asyncRoute(commentsCtrl.getForFinding));
router.post('/:id/comments', authMiddleware, asyncRoute(commentsCtrl.create));