const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

function adminMiddleware(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware };