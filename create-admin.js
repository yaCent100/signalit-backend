const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/db');

async function createUser() {
    const email = 'yasscode87@gmail.com';
    const password = 'Sanji0512@';
    const name = 'Yassine';

    const password_hash = bcrypt.hashSync(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name, is_admin) VALUES ($1, $2, $3, true) RETURNING id, email, name, is_admin',
            [email, password_hash, name]
        );
        console.log('Utilisateur créé avec succès :', result.rows[0]);
    } catch (err) {
        console.error('Erreur :', err.message);
    }
    process.exit(0);
}

createUser();
