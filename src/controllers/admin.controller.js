const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function getAll(req, res) {
    const result = await pool.query(`
    SELECT id, name, email, is_admin,
    (SELECT COUNT(*) FROM findings WHERE findings.user_id = users.id) as finding_count
    FROM users
  `);

    res.json(result.rows);
}

async function update(req, res) {
    const { name, email, is_admin } = req.body;
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const user = existing.rows[0];

    await pool.query(
        'UPDATE users SET name = $1, email = $2, is_admin = $3 WHERE id = $4',
        [name || user.name, email || user.email, is_admin !== undefined ? !!is_admin : user.is_admin, req.params.id]
    );

    const updated = await pool.query('SELECT id, name, email, is_admin FROM users WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
}

async function remove(req, res) {
    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).send();
}

async function create(req, res) {
    const { name, email, password, is_admin } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email et password sont requis' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, email, password_hash, !!is_admin]
        );

        res.status(201).json({ id: result.rows[0].id, name, email, is_admin: !!is_admin });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
        }
        throw err;
    }
}

module.exports = { getAll, update, remove, create };