const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

async function register(req, res) {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password et name sont requis' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
            [email, password_hash, name]
        );

        res.status(201).json({ id: result.rows[0].id, email, name });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
        }
        throw err;
    }
}

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email et password sont requis' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin } });
}

module.exports = { register, login };