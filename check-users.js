const db = require('./db');

console.log('Type de db:', typeof db);
console.log('db a une méthode query ?', typeof db.query);

db.query('SELECT id, email, name FROM users')
    .then((result) => {
        console.log('Utilisateurs trouvés :', result.rows);
        process.exit(0);
    })
    .catch((err) => {
        console.error('Erreur requête :', err);
        process.exit(1);
    });
