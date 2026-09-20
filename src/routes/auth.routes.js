const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const asyncRoute = require('../utils/asyncRoute');

router.post('/register', asyncRoute(ctrl.register));
router.post('/login', asyncRoute(ctrl.login));

module.exports = router;