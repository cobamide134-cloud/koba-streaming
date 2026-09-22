const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./koba.db');

db.serialize(() => {
    // 1. Comptes maîtres (Netflix, Prime, Spotify, VPN, etc.)
    db.run(`CREATE TABLE IF NOT EXISTS comptes_maitres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plateforme TEXT NOT NULL,
        email TEXT NOT NULL,
        mot_de_passe TEXT,
        cout_achat REAL DEFAULT 0,
        max_profils INTEGER DEFAULT 1,
        date_reabonnement TEXT,
        notes TEXT
    )`);

    // 2. Clients
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT,
        telephone TEXT UNIQUE
    )`);

    // 3. Abonnements / Profils clients
    db.run(`CREATE TABLE IF NOT EXISTS abonnements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        compte_maitre_id INTEGER,
        plateforme TEXT,
        type_formule TEXT,
        nom_profil TEXT,
        code_profil TEXT,
        email_client TEXT,
        adresse_client TEXT,
        prix_vente REAL DEFAULT 0,
        cout_achat_partiel REAL DEFAULT 0,
        date_debut TEXT,
        date_fin TEXT,
        statut TEXT DEFAULT 'Actif',
        statut_paiement TEXT DEFAULT 'Payé',
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (compte_maitre_id) REFERENCES comptes_maitres(id)
    )`);

    // 4. Dépenses personnelles (soustrait du bénéfice)
    db.run(`CREATE TABLE IF NOT EXISTS depenses_personnelles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        montant REAL NOT NULL,
        date TEXT
    )`);

    // 5. Ventes et services externes
    db.run(`CREATE TABLE IF NOT EXISTS ventes_externes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_nom TEXT,
        client_telephone TEXT,
        description TEXT,
        prix_vente REAL DEFAULT 0,
        cout_achat REAL DEFAULT 0,
        date TEXT
    )`);
});

module.exports = db;