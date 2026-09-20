const { pool } = require('../config/db');

async function getForFinding(req, res) {
    const result = await pool.query(
        `SELECT comments.*, users.name as author_name
     FROM comments
     JOIN users ON users.id = comments.user_id
     WHERE finding_id = $1
     ORDER BY created_at ASC`,
        [req.params.id]
    );

    res.json(result.rows);
}

async function create(req, res) {
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    const result = await pool.query(
        `INSERT INTO comments (finding_id, user_id, content) VALUES ($1, $2, $3) RETURNING id`,
        [req.params.id, req.user.id, content.trim()]
    );

    const comment = await pool.query(
        `SELECT comments.*, users.name as author_name
     FROM comments JOIN users ON users.id = comments.user_id
     WHERE comments.id = $1`,
        [result.rows[0].id]
    );

    res.status(201).json(comment.rows[0]);
}

module.exports = { getForFinding, create };