const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.text({ limit: '10mb' }));

// Protection d'accès par mot de passe (Basic Auth)
const adminEmail = process.env.ADMIN_EMAIL || 'admin@exemple.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'motdepasse123';

app.use(basicAuth({
    users: { [adminEmail]: adminPassword },
    challenge: true,
    unauthorizedResponse: 'Accès refusé : Identifiants incorrects.'
}));

// Fichiers statiques (protégés)
app.use(express.static(path.join(__dirname, 'public')));

// Connexion / Création de la base de données SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Erreur d'ouverture DB:", err.message);
    else console.log("Connecté à la base de données SQLite.");
});

// Initialisation des tables et mise à jour automatique des colonnes
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS comptes_maitres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plateforme TEXT,
        email TEXT,
        mot_de_passe TEXT,
        cout_achat REAL,
        max_profils INTEGER,
        date_reabonnement TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS abonnements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_nom TEXT,
        client_telephone TEXT,
        plateforme TEXT,
        compte_maitre_id INTEGER,
        nom_profil TEXT,
        profil_mot_de_passe TEXT,
        prix_vente REAL,
        date_fin TEXT,
        renouvellement TEXT,
        paiement TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS depenses_personnelles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        montant REAL,
        date TEXT DEFAULT CURRENT_DATE
    )`);

    db.run(`ALTER TABLE abonnements ADD COLUMN profil_mot_de_passe TEXT`, (err) => {});
    db.run(`ALTER TABLE abonnements ADD COLUMN compte_maitre_id INTEGER`, (err) => {});
});

// ROUTE : RÉSUMÉ FINANCIER (DASHBOARD)
app.get('/api/finances/resume', (req, res) => {
    const q1 = `SELECT COALESCE(SUM(prix_vente), 0) as totalRevenus FROM abonnements`;
    const q2 = `SELECT COALESCE(SUM(cout_achat), 0) as totalCoutsAchat FROM comptes_maitres`;
    const q3 = `SELECT COALESCE(SUM(montant), 0) as totalDepensesPerso FROM depenses_personnelles`;

    db.get(q1, [], (err, r1) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get(q2, [], (err, r2) => {
            if (err) return res.status(500).json({ error: err.message });
            db.get(q3, [], (err, r3) => {
                if (err) return res.status(500).json({ error: err.message });
                const totalRevenus = r1.totalRevenus;
                const totalCoutsAchat = r2.totalCoutsAchat;
                const totalDepensesPerso = r3.totalDepensesPerso;
                const beneficeBrut = totalRevenus - totalCoutsAchat;
                const soldeNet = beneficeBrut - totalDepensesPerso;
                res.json({ totalRevenus, totalCoutsAchat, beneficeBrut, totalDepensesPerso, soldeNet });
            });
        });
    });
});

// 1. ROUTE : HISTORIQUE FINANCIER MENSUEL
app.get('/api/finances/historique-mensuel', (req, res) => {
    const query = `
        SELECT 
            mois,
            SUM(revenus) as totalRevenus,
            SUM(couts) as totalCouts,
            SUM(depenses) as totalDepenses
        FROM (
            SELECT strftime('%Y-%m', date_fin) as mois, prix_vente as revenus, 0 as couts, 0 as depenses FROM abonnements WHERE date_fin IS NOT NULL
            UNION ALL
            SELECT strftime('%Y-%m', date_reabonnement) as mois, 0 as revenus, cout_achat as couts, 0 as depenses FROM comptes_maitres WHERE date_reabonnement IS NOT NULL
            UNION ALL
            SELECT strftime('%Y-%m', date) as mois, 0 as revenus, 0 as couts, montant as depenses FROM depenses_personnelles WHERE date IS NOT NULL
        )
        WHERE mois IS NOT NULL
        GROUP BY mois
        ORDER BY mois DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const historique = rows.map(r => {
            const beneficeBrut = (r.totalRevenus || 0) - (r.totalCouts || 0);
            const beneficeNet = beneficeBrut - (r.totalDepenses || 0);
            return {
                mois: r.mois,
                revenus: r.totalRevenus || 0,
                couts: r.totalCouts || 0,
                benefice_brut: beneficeBrut,
                depenses_perso: r.totalDepenses || 0,
                benefice_net: beneficeNet
            };
        });

        res.json({ historique });
    });
});

// 2. ROUTE : COMPTES MAÎTRES
app.get('/api/comptes-maitres', (req, res) => {
    const query = `
        SELECT c.*, 
               (SELECT COUNT(*) FROM abonnements a WHERE a.compte_maitre_id = c.id) as profils_utilises,
               (SELECT COALESCE(SUM(a.prix_vente), 0) FROM abonnements a WHERE a.compte_maitre_id = c.id) as total_vendu
        FROM comptes_maitres c
        ORDER BY c.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ comptes: rows });
    });
});

app.post('/api/comptes-maitres', (req, res) => {
    const { plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement } = req.body;
    db.run(
        `INSERT INTO comptes_maitres (plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement) VALUES (?, ?, ?, ?, ?, ?)`,
        [plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/comptes-maitres/:id', (req, res) => {
    const { id } = req.params;
    const { plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement } = req.body;
    const query = `UPDATE comptes_maitres SET plateforme = ?, email = ?, mot_de_passe = ?, cout_achat = ?, max_profils = ?, date_reabonnement = ? WHERE id = ?`;
    
    db.run(query, [plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Compte maître mis à jour avec succès !" });
    });
});

app.delete('/api/comptes-maitres/:id', (req, res) => {
    db.run(`DELETE FROM comptes_maitres WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Compte maître supprimé" });
    });
});

// 3. ROUTE : ABONNÉS & VENTES
app.get('/api/abonnements', (req, res) => {
    db.all(`
        SELECT a.*, c.email as compte_email 
        FROM abonnements a 
        LEFT JOIN comptes_maitres c ON a.compte_maitre_id = c.id
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ abonnements: rows });
    });
});

app.post('/api/abonnements', (req, res) => {
    const { nom, telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement } = req.body;
    db.run(
        `INSERT INTO abonnements (client_nom, client_telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nom, telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/abonnements/:id', (req, res) => {
    const { nom, telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement } = req.body;
    db.run(
        `UPDATE abonnements 
         SET client_nom = ?, client_telephone = ?, plateforme = ?, compte_maitre_id = ?, nom_profil = ?, profil_mot_de_passe = ?, prix_vente = ?, date_fin = ?, renouvellement = ?, paiement = ? 
         WHERE id = ?`,
        [nom, telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Abonnement mis à jour" });
        }
    );
});

app.delete('/api/abonnements/:id', (req, res) => {
    db.run(`DELETE FROM abonnements WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Abonnement supprimé" });
    });
});

app.delete('/api/abonnements/vider/tout', (req, res) => {
    db.run(`DELETE FROM abonnements`, [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Toutes les données ont été supprimées" });
    });
});

// 4. ROUTE : DÉPENSES PERSONNELLES
app.get('/api/depenses-personnelles', (req, res) => {
    db.all(`SELECT * FROM depenses_personnelles ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/depenses-personnelles', (req, res) => {
    const { description, montant } = req.body;
    db.run(
        `INSERT INTO depenses_personnelles (description, montant) VALUES (?, ?)`,
        [description, montant],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, description, montant });
        }
    );
});

app.delete('/api/depenses-personnelles/:id', (req, res) => {
    db.run(`DELETE FROM depenses_personnelles WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Dépense supprimée" });
    });
});

// 5. ROUTE : ALERTES J-3
app.get('/api/alertes-j3', (req, res) => {
    const queryClients = `
        SELECT client_nom as nom, client_telephone as telephone, plateforme, date_fin,
               CAST(julianday(date(date_fin)) - julianday(date('now', 'start of day')) AS INTEGER) as jours_restants
        FROM abonnements 
        WHERE date(date_fin) <= date('now', '+3 days') 
          AND date(date_fin) >= date('now', 'start of day')
        ORDER BY date_fin ASC
    `;
    const queryComptes = `
        SELECT plateforme, email, date_reabonnement,
               CAST(julianday(date(date_reabonnement)) - julianday(date('now', 'start of day')) AS INTEGER) as jours_restants
        FROM comptes_maitres 
        WHERE date(date_reabonnement) <= date('now', '+3 days') 
          AND date(date_reabonnement) >= date('now', 'start of day')
        ORDER BY date_reabonnement ASC
    `;

    db.all(queryClients, [], (err, clients) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(queryComptes, [], (err, comptes) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ clientsAExpirer: clients || [], comptesAReabonner: comptes || [] });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});