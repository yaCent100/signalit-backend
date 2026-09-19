// Script de "seed" — génère 50 signalements de test dans la base
// Usage : node seed.js
// Nécessite qu'un utilisateur existe déjà (utilise le premier utilisateur trouvé)

const db = require('./db'); // db est maintenant un "pool" pg

const categories = ['Objet trouvé', 'Objet perdu', 'Danger', 'Autre'];
const statuses = ['nouveau', 'en_cours', 'resolu'];

const titles = [
    'Sac à dos abandonné',
    'Trottoir endommagé',
    'Portefeuille trouvé',
    'Éclairage public défectueux',
    'Vélo abandonné',
    'Nid de poule dangereux',
    'Clés retrouvées',
    'Graffiti sur mur public',
    'Chat errant',
    'Fuite d\'eau visible',
    'Téléphone perdu',
    'Poubelle débordante',
    'Banc public cassé',
    'Parapluie oublié',
    'Câble électrique au sol',
    'Chien errant',
    'Vitrine brisée',
    'Lunettes retrouvées',
    'Signalisation manquante',
    'Dépôt sauvage de déchets',
];

// Centré autour de Bruxelles, avec un peu de dispersion aléatoire
const BASE_LAT = 50.8503;
const BASE_LNG = 4.3517;

function randomOffset() {
    return (Math.random() - 0.5) * 0.1; // +/- environ 5km
}

function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function seed() {
    // On récupère le premier utilisateur existant pour lui attribuer les signalements
    const result = await db.query('SELECT id FROM users LIMIT 1');
    const user = result.rows[0];

    if (!user) {
        console.error('Aucun utilisateur trouvé. Crée un compte via /api/register avant de lancer ce script.');
        process.exit(1);
    }

    let count = 0;
    for (let i = 0; i < 50; i++) {
        const title = `${randomFrom(titles)} #${i + 1}`;
        const description = `Signalement de test généré automatiquement pour démonstration.`;
        const category = randomFrom(categories);
        const status = randomFrom(statuses);
        const latitude = BASE_LAT + randomOffset();
        const longitude = BASE_LNG + randomOffset();

        await db.query(`
      INSERT INTO incidents (user_id, title, description, category, status, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [user.id, title, description, category, status, latitude, longitude]);

        count++;
    }

    console.log(`${count} signalements de test créés avec succès pour l'utilisateur id=${user.id}.`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('Erreur lors du seed :', err);
    process.exit(1);
});