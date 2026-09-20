const db = require('./db'); // db est maintenant un "pool" pg
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
const PORT = process.env.PORT || 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads'),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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

// Petit helper pour éviter de répéter try/catch partout.
// Enveloppe une route async et transmet toute erreur à un handler générique.
function asyncRoute(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

app.get('/', (req, res) => {
    res.send('Hello depuis mon serveur !');
});

app.patch('/api/incidents/:id/status', authMiddleware, asyncRoute(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['nouveau', 'en_cours', 'resolu'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status doit être l'un de : ${validStatuses.join(', ')}` });
    }

    const existing = await db.query('SELECT id FROM incidents WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Signalement introuvable' });
    }

    await db.query('UPDATE incidents SET status = $1 WHERE id = $2', [status, req.params.id]);

    const updated = await db.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
}));

app.get('/api/incidents/:id', asyncRoute(async (req, res) => {
    const result = await db.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Signalement introuvable' });
    }

    res.json(result.rows[0]);
}));

app.get('/api/incidents', asyncRoute(async (req, res) => {
    const result = await db.query('SELECT * FROM incidents');
    res.json(result.rows);
}));

app.post('/api/incidents', authMiddleware, upload.single('photo'), asyncRoute(async (req, res) => {
    const { title, description, category, latitude, longitude } = req.body;

    if (!title || !category || !latitude || !longitude) {
        return res.status(400).json({ error: 'title, category, latitude et longitude sont requis' });
    }

    const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await db.query(`
    INSERT INTO incidents (user_id, title, description, category, latitude, longitude, photo_path)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [req.user.id, title, description || '', category, latitude, longitude, photo_path]);

    const newIncident = await db.query('SELECT * FROM incidents WHERE id = $1', [result.rows[0].id]);
    res.status(201).json(newIncident.rows[0]);
}));

app.put('/api/incidents/:id', authMiddleware, asyncRoute(async (req, res) => {
    const { title, description, category } = req.body;

    const existing = await db.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Signalement introuvable' });
    }
    const incident = existing.rows[0];

    if (incident.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Non autorisé à modifier ce signalement' });
    }

    await db.query(`
    UPDATE incidents SET title = $1, description = $2, category = $3
    WHERE id = $4
  `, [title || incident.title, description ?? incident.description, category || incident.category, req.params.id]);

    const updated = await db.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
}));

app.post('/api/register', asyncRoute(async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password et name sont requis' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = await db.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
            [email, password_hash, name]
        );

        res.status(201).json({ id: result.rows[0].id, email, name });
    } catch (err) {
        if (err.code === '23505') { // violation de contrainte UNIQUE en Postgres
            return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
        }
        throw err;
    }
}));

app.post('/api/login', asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email et password sont requis' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
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
}));

// GET les commentaires d'un signalement
app.get('/api/incidents/:id/comments', asyncRoute(async (req, res) => {
    const result = await db.query(`
    SELECT comments.*, users.name as author_name
    FROM comments
    JOIN users ON users.id = comments.user_id
    WHERE incident_id = $1
    ORDER BY created_at ASC
  `, [req.params.id]);

    res.json(result.rows);
}));

// POST un nouveau commentaire (protégé)
app.post('/api/incidents/:id/comments', authMiddleware, asyncRoute(async (req, res) => {
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    const result = await db.query(`
    INSERT INTO comments (incident_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [req.params.id, req.user.id, content.trim()]);

    const comment = await db.query(`
    SELECT comments.*, users.name as author_name
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.id = $1
  `, [result.rows[0].id]);

    res.status(201).json(comment.rows[0]);
}));

app.get('/api/admin/users', authMiddleware, asyncRoute(async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const result = await db.query(`
    SELECT id, name, email, is_admin,
    (SELECT COUNT(*) FROM incidents WHERE incidents.user_id = users.id) as incident_count
    FROM users
  `);

    res.json(result.rows);
}));

// Modifier un utilisateur (nom, email, statut admin)
app.put('/api/admin/users/:id', authMiddleware, asyncRoute(async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const { name, email, is_admin } = req.body;
    const existing = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

    if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const user = existing.rows[0];

    await db.query(
        'UPDATE users SET name = $1, email = $2, is_admin = $3 WHERE id = $4',
        [name || user.name, email || user.email, is_admin !== undefined ? !!is_admin : user.is_admin, req.params.id]
    );

    const updated = await db.query('SELECT id, name, email, is_admin FROM users WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
}));

// Supprimer un utilisateur
app.delete('/api/admin/users/:id', authMiddleware, asyncRoute(async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).send();
}));

// Créer un utilisateur (par un admin)
app.post('/api/admin/users', authMiddleware, asyncRoute(async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const { name, email, password, is_admin } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email et password sont requis' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = await db.query(
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
}));

// Handler d'erreur générique : toute erreur non gérée dans une route asyncRoute finit ici
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
