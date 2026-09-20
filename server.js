require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./src/config/db');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api', require('./src/routes/auth.routes'));
app.use('/api/findings', require('./src/routes/findings.routes'));
app.use('/api/admin/users', require('./src/routes/admin.routes'));

app.get('/', (req, res) => {
    res.send('Hello depuis mon serveur !');
});

// Handler d'erreur générique
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;

initDb()
    .then(() => {
        console.log('✅ Tables Postgres prêtes');
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Erreur init DB:', err);
    });