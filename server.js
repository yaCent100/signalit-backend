const db = require('./db');
const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
const PORT = 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'change_moi_en_prod_par_un_vrai_secret_long_et_aleatoire';
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
        req.user = payload; // on attache les infos user à la requête, dispo pour la suite
        next(); // tout est bon, on continue vers la route
    } catch (err) {
        res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

app.get('/', (req, res) => {
    res.send('Hello depuis mon serveur !');
});

app.patch('/api/incidents/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['nouveau', 'en_cours', 'resolu'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status doit être l'un de : ${validStatuses.join(', ')}` });
    }

    const existing = db.prepare('SELECT id FROM incidents WHERE id = ?').get(req.params.id);
    if (!existing) {
        return res.status(404).json({ error: 'Signalement introuvable' });
    }

    db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(status, req.params.id);

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    res.json(updated);
});

app.get('/api/incidents/:id', (req, res) => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);

    if (!incident) {
        return res.status(404).json({ error: 'Signalement introuvable' });
    }

    res.json(incident);
});

app.get('/api/incidents', (req, res) => {
    const incidents = db.prepare('SELECT * FROM incidents').all();
    res.json(incidents);
});

app.post('/api/incidents', authMiddleware, upload.single('photo'), (req, res) => {
    const { title, description, category, latitude, longitude } = req.body;

    if (!title || !category || !latitude || !longitude) {
        return res.status(400).json({ error: 'title, category, latitude et longitude sont requis' });
    }

    const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
    INSERT INTO incidents (user_id, title, description, category, latitude, longitude, photo_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || '', category, latitude, longitude, photo_path);

    const newIncident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newIncident);
});

app.put('/api/incidents/:id', authMiddleware, (req, res) => {
    const { title, description, category } = req.body;

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    if (!incident) {
        return res.status(404).json({ error: 'Signalement introuvable' });
    }

    if (incident.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Non autorisé à modifier ce signalement' });
    }

    db.prepare(`
    UPDATE incidents SET title = ?, description = ?, category = ?
    WHERE id = ?
  `).run(title || incident.title, description ?? incident.description, category || incident.category, req.params.id);

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    res.json(updated);
});

app.post('/api/register', (req, res) => {
    const { email, password, name } = req.body;

    // On vérifie qu'aucun champ n'est manquant
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password et name sont requis' });
    }

    // On transforme le mot de passe en hash sécurisé
    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = db.prepare(
            'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
        ).run(email, password_hash, name);

        res.status(201).json({ id: result.lastInsertRowid, email, name });
    } catch (err) {
        res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }
});
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email et password sont requis' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin } });
});

// GET les commentaires d'un signalement
app.get('/api/incidents/:id/comments', (req, res) => {
    const comments = db.prepare(`
    SELECT comments.*, users.name as author_name
    FROM comments
    JOIN users ON users.id = comments.user_id
    WHERE incident_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);

    res.json(comments);
});

// POST un nouveau commentaire (protégé)
app.post('/api/incidents/:id/comments', authMiddleware, (req, res) => {
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    const result = db.prepare(`
    INSERT INTO comments (incident_id, user_id, content)
    VALUES (?, ?, ?)
  `).run(req.params.id, req.user.id, content.trim());

    const comment = db.prepare(`
    SELECT comments.*, users.name as author_name
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.id = ?
  `).get(result.lastInsertRowid);

    res.status(201).json(comment);
});

app.get('/api/admin/users', authMiddleware, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const users = db.prepare(`
    SELECT id, name, email, is_admin,
    (SELECT COUNT(*) FROM incidents WHERE incidents.user_id = users.id) as incident_count
    FROM users
  `).all();

    res.json(users);
});

// Modifier un utilisateur (nom, email, statut admin)
app.put('/api/admin/users/:id', authMiddleware, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const { name, email, is_admin } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
        return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    db.prepare('UPDATE users SET name = ?, email = ?, is_admin = ? WHERE id = ?')
        .run(name || user.name, email || user.email, is_admin !== undefined ? (is_admin ? 1 : 0) : user.is_admin, req.params.id);

    const updated = db.prepare('SELECT id, name, email, is_admin FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
});

// Supprimer un utilisateur
app.delete('/api/admin/users/:id', authMiddleware, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.status(204).send();
});

// Créer un utilisateur (par un admin)
app.post('/api/admin/users', authMiddleware, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const { name, email, password, is_admin } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email et password sont requis' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = db.prepare(
            'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'
        ).run(name, email, password_hash, is_admin ? 1 : 0);

        res.status(201).json({ id: result.lastInsertRowid, name, email, is_admin: is_admin ? 1 : 0 });
    } catch (err) {
        res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});