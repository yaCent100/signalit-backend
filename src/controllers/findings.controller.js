const { pool } = require('../config/db');

async function getAll(req, res) {
    const result = await pool.query('SELECT * FROM findings');
    res.json(result.rows);
}

async function getOne(req, res) {
    const result = await pool.query('SELECT * FROM findings WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Découverte introuvable' });
    }

    res.json(result.rows[0]);
}

async function create(req, res) {
    const { title, description, category, latitude, longitude } = req.body;

    if (!title || !category || !latitude || !longitude) {
        return res.status(400).json({ error: 'title, category, latitude et longitude sont requis' });
    }

    const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
        `INSERT INTO findings (user_id, title, description, category, latitude, longitude, photo_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
        [req.user.id, title, description || '', category, latitude, longitude, photo_path]
    );

    const newFinding = await pool.query('SELECT * FROM findings WHERE id = $1', [result.rows[0].id]);
    res.status(201).json(newFinding.rows[0]);
}

async function update(req, res) {
    const { title, description, category } = req.body;

    const existing = await pool.query('SELECT * FROM findings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Découverte introuvable' });
    }
    const finding = existing.rows[0];

    if (finding.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Non autorisé à modifier cette découverte' });
    }

    await pool.query(
        `UPDATE findings SET title = $1, description = $2, category = $3 WHERE id = $4`,
        [title || finding.title, description ?? finding.description, category || finding.category, req.params.id]
    );

    const updated = await pool.query('SELECT * FROM findings WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
}

async function updateStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['nouveau', 'en_cours', 'resolu'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status doit être l'un de : ${validStatuses.join(', ')}` });
    }

    const existing = await pool.query('SELECT id FROM findings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Découverte introuvable' });
    }

    await pool.query('UPDATE findings SET status = $1 WHERE id = $2', [status, req.params.id]);

    const updated = await pool.query('SELECT * FROM findings WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
}

module.exports = { getAll, getOne, create, update, updateStatus };