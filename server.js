const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ limit: '10mb' }));

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'koba-streaming-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Session valide 24h
}));

// Configuration de la connexion PostgreSQL (Neon / Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialisation automatique des tables dans PostgreSQL
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS comptes_maitres (
                id SERIAL PRIMARY KEY,
                plateforme TEXT,
                email TEXT,
                mot_de_passe TEXT,
                cout_achat REAL,
                max_profils INTEGER,
                date_reabonnement TEXT,
                carte_bancaire TEXT
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS abonnements (
                id SERIAL PRIMARY KEY,
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
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS depenses_personnelles (
                id SERIAL PRIMARY KEY,
                description TEXT,
                montant REAL,
                date TEXT DEFAULT CURRENT_DATE
            );
        `);

        // Migrations de securite si colonnes manquantes
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE abonnements ADD COLUMN profil_mot_de_passe TEXT;
                EXCEPTION WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE abonnements ADD COLUMN compte_maitre_id INTEGER;
                EXCEPTION WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE comptes_maitres ADD COLUMN carte_bancaire TEXT;
                EXCEPTION WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `);

        console.log("Connecté et initialisé sur la base de données PostgreSQL.");
    } catch (err) {
        console.error("Erreur d'initialisation PostgreSQL :", err.message);
    }
};

initDb();

// Identifiants administrateur
const adminEmail = process.env.ADMIN_EMAIL || 'admin@exemple.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'motdepasse123';

// ROUTE DE CONNEXION (POST)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminEmail && password === adminPassword) {
        req.session.isAuthenticated = true;
        res.redirect('/');
    } else {
        res.redirect('/login.html?error=1');
    }
});

// ROUTE DE DÉCONNEXION
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

// MIDDLEWARE DE PROTECTION DES ROUTES DU TABLEAU DE BORD
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login.html');
};

// Route pour la page de login statique
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protection de l'application principale (Fichiers statiques et APIs)
app.use('/', requireAuth, express.static(path.join(__dirname, 'public')));

// ROUTE : RÉSUMÉ FINANCIER (DASHBOARD)
app.get('/api/finances/resume', requireAuth, async (req, res) => {
    try {
        const q1 = `SELECT COALESCE(SUM(prix_vente), 0) as "totalRevenus" FROM abonnements`;
        const q2 = `SELECT COALESCE(SUM(cout_achat), 0) as "totalCoutsAchat" FROM comptes_maitres`;
        const q3 = `SELECT COALESCE(SUM(montant), 0) as "totalDepensesPerso" FROM depenses_personnelles`;

        const r1 = await pool.query(q1);
        const r2 = await pool.query(q2);
        const r3 = await pool.query(q3);

        const totalRevenus = parseFloat(r1.rows[0].totalRevenus) || 0;
        const totalCoutsAchat = parseFloat(r2.rows[0].totalCoutsAchat) || 0;
        const totalDepensesPerso = parseFloat(r3.rows[0].totalDepensesPerso) || 0;

        const beneficeBrut = totalRevenus - totalCoutsAchat;
        const soldeNet = beneficeBrut - totalDepensesPerso;

        res.json({ totalRevenus, totalCoutsAchat, beneficeBrut, totalDepensesPerso, soldeNet });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. ROUTE : HISTORIQUE FINANCIER MENSUEL
app.get('/api/finances/historique-mensuel', requireAuth, async (req, res) => {
    const query = `
        SELECT 
            mois,
            SUM(revenus) as "totalRevenus",
            SUM(couts) as "totalCouts",
            SUM(depenses) as "totalDepenses"
        FROM (
            SELECT LEFT(date_fin, 7) as mois, prix_vente as revenus, 0 as couts, 0 as depenses FROM abonnements WHERE date_fin IS NOT NULL AND date_fin != ''
            UNION ALL
            SELECT LEFT(date_reabonnement, 7) as mois, 0 as revenus, cout_achat as couts, 0 as depenses FROM comptes_maitres WHERE date_reabonnement IS NOT NULL AND date_reabonnement != ''
            UNION ALL
            SELECT LEFT(date::text, 7) as mois, 0 as revenus, 0 as couts, montant as depenses FROM depenses_personnelles WHERE date IS NOT NULL
        ) sub
        WHERE mois IS NOT NULL AND LENGTH(mois) = 7
        GROUP BY mois
        ORDER BY mois DESC
    `;

    try {
        const result = await pool.query(query);
        const historique = result.rows.map(r => {
            const totalRevenus = parseFloat(r.totalRevenus) || 0;
            const totalCouts = parseFloat(r.totalCouts) || 0;
            const totalDepenses = parseFloat(r.totalDepenses) || 0;
            const beneficeBrut = totalRevenus - totalCouts;
            const beneficeNet = beneficeBrut - totalDepenses;

            return {
                mois: r.mois,
                revenus: totalRevenus,
                couts: totalCouts,
                benefice_brut: beneficeBrut,
                depenses_perso: totalDepenses,
                benefice_net: beneficeNet
            };
        });

        res.json({ historique });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. ROUTE : COMPTES MAÎTRES
app.get('/api/comptes-maitres', requireAuth, async (req, res) => {
    const query = `
        SELECT c.*, 
               (SELECT COUNT(*) FROM abonnements a WHERE a.compte_maitre_id = c.id) as profils_utilises,
               (SELECT COALESCE(SUM(a.prix_vente), 0) FROM abonnements a WHERE a.compte_maitre_id = c.id) as total_vendu
        FROM comptes_maitres c
        ORDER BY c.id DESC
    `;
    try {
        const result = await pool.query(query);
        res.json({ comptes: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/comptes-maitres', requireAuth, async (req, res) => {
    const { plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement, carte_bancaire } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO comptes_maitres (plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement, carte_bancaire) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement, carte_bancaire || '']
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/comptes-maitres/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement, carte_bancaire } = req.body;
    const query = `UPDATE comptes_maitres SET plateforme = $1, email = $2, mot_de_passe = $3, cout_achat = $4, max_profils = $5, date_reabonnement = $6, carte_bancaire = $7 WHERE id = $8`;
    try {
        await pool.query(query, [plateforme, email, mot_de_passe, cout_achat, max_profils, date_reabonnement, carte_bancaire || '', id]);
        res.json({ message: "Compte maître mis à jour avec succès !" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/comptes-maitres/:id', requireAuth, async (req, res) => {
    try {
        await pool.query(`DELETE FROM comptes_maitres WHERE id = $1`, [req.params.id]);
        res.json({ message: "Compte maître supprimé" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. ROUTE : ABONNÉS & VENTES
app.get('/api/abonnements', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, c.email as compte_email 
            FROM abonnements a 
            LEFT JOIN comptes_maitres c ON a.compte_maitre_id = c.id
            ORDER BY a.id DESC
        `);
        res.json({ abonnements: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/abonnements', requireAuth, async (req, res) => {
    const { nom, telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO abonnements (client_nom, client_telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [nom, telephone, plateforme, compte_maitre_id || null, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/abonnements/:id', requireAuth, async (req, res) => {
    const { nom, telephone, plateforme, compte_maitre_id, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement } = req.body;
    try {
        await pool.query(
            `UPDATE abonnements 
             SET client_nom = $1, client_telephone = $2, plateforme = $3, compte_maitre_id = $4, nom_profil = $5, profil_mot_de_passe = $6, prix_vente = $7, date_fin = $8, renouvellement = $9, paiement = $10 
             WHERE id = $11`,
            [nom, telephone, plateforme, compte_maitre_id || null, nom_profil, profil_mot_de_passe, prix_vente, date_fin, renouvellement, paiement, req.params.id]
        );
        res.json({ message: "Abonnement mis à jour" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/abonnements/:id', requireAuth, async (req, res) => {
    try {
        await pool.query(`DELETE FROM abonnements WHERE id = $1`, [req.params.id]);
        res.json({ message: "Abonnement supprimé" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/abonnements/vider/tout', requireAuth, async (req, res) => {
    try {
        await pool.query(`DELETE FROM abonnements`);
        res.json({ message: "Toutes les données ont été supprimées" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. ROUTE : DÉPENSES PERSONNELLES
app.get('/api/depenses-personnelles', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM depenses_personnelles ORDER BY id DESC`);
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/depenses-personnelles', requireAuth, async (req, res) => {
    const { description, montant } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO depenses_personnelles (description, montant) VALUES ($1, $2) RETURNING id`,
            [description, montant]
        );
        res.json({ id: result.rows[0].id, description, montant });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/depenses-personnelles/:id', requireAuth, async (req, res) => {
    try {
        await pool.query(`DELETE FROM depenses_personnelles WHERE id = $1`, [req.params.id]);
        res.json({ message: "Dépense supprimée" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. ROUTE : ALERTES J-3
app.get('/api/alertes-j3', requireAuth, async (req, res) => {
    const queryClients = `
        SELECT client_nom as nom, client_telephone as telephone, plateforme, date_fin,
               CAST(CAST(date_fin AS DATE) - CURRENT_DATE AS INTEGER) as jours_restants
        FROM abonnements 
        WHERE date_fin IS NOT NULL AND date_fin != '' 
          AND CAST(date_fin AS DATE) <= CURRENT_DATE + INTERVAL '3 days' 
          AND CAST(date_fin AS DATE) >= CURRENT_DATE
        ORDER BY date_fin ASC
    `;
    const queryComptes = `
        SELECT plateforme, email, date_reabonnement, carte_bancaire,
               CAST(CAST(date_reabonnement AS DATE) - CURRENT_DATE AS INTEGER) as jours_restants
        FROM comptes_maitres 
        WHERE date_reabonnement IS NOT NULL AND date_reabonnement != '' 
          AND CAST(date_reabonnement AS DATE) <= CURRENT_DATE + INTERVAL '3 days' 
          AND CAST(date_reabonnement AS DATE) >= CURRENT_DATE
        ORDER BY date_reabonnement ASC
    `;

    try {
        const clients = await pool.query(queryClients);
        const comptes = await pool.query(queryComptes);
        res.json({ clientsAExpirer: clients.rows || [], comptesAReabonner: comptes.rows || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});