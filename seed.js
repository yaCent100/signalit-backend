// Script de "seed" — génère 50 signalements de test dans la base
// Usage : node seed.js
// Nécessite qu'un utilisateur existe déjà (utilise le premier utilisateur trouvé)

const db = require('./db');

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

// On récupère le premier utilisateur existant pour lui attribuer les signalements
const user = db.prepare('SELECT id FROM users LIMIT 1').get();

if (!user) {
    console.error('Aucun utilisateur trouvé. Crée un compte via /api/register avant de lancer ce script.');
    process.exit(1);
}

const insert = db.prepare(`
  INSERT INTO incidents (user_id, title, description, category, status, latitude, longitude)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let count = 0;
for (let i = 0; i < 50; i++) {
    const title = `${randomFrom(titles)} #${i + 1}`;
    const description = `Signalement de test généré automatiquement pour démonstration.`;
    const category = randomFrom(categories);
    const status = randomFrom(statuses);
    const latitude = BASE_LAT + randomOffset();
    const longitude = BASE_LNG + randomOffset();

    insert.run(user.id, title, description, category, status, latitude, longitude);
    count++;
}

console.log(`${count} signalements de test créés avec succès pour l'utilisateur id=${user.id}.`);