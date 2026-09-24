// Navigation entre les onglets
function showTab(tabId, evt) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.style.display = 'block';
    
    const currentEvt = evt || window.event;
    if (currentEvt && currentEvt.currentTarget) {
        currentEvt.currentTarget.classList.add('active');
    }

    if (tabId === 'dashboard') chargerFinances();
    if (tabId === 'historique') chargerHistorique();
    if (tabId === 'rappels') chargerAlertes();
    if (tabId === 'comptes') chargerComptes();
    if (tabId === 'abonnes') chargerAbonnes();
    if (tabId === 'depenses') chargerDepenses();
}

// Fonction de déconnexion de la session HTTP Basic Auth
function deconnexion() {
    if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
        // Envoie de faux identifiants pour réinitialiser le cache d'authentification du navigateur
        fetch('/api/finances/resume', {
            headers: { 'Authorization': 'Basic ' + btoa('logout:logout') }
        }).finally(() => {
            window.location.href = '/logout';
        });
    }
}

// Générateur de lien WhatsApp international avec messages personnalisés selon l'expiration
function genererLienWhatsApp(telephone, nom, plateforme, joursRestants) {
    let phoneClean = (telephone || '').replace(/\D/g, '');
    
    if (phoneClean.length === 8) {
        phoneClean = '229' + phoneClean;
    }

    let message = "";
    if (joursRestants <= 0) {
        message = `cc, vous allez bien j'espère. je tiens à vous informer que votre abonnement à expirer. Merci`;
    } else {
        const nbJoursTxt = joursRestants === 1 ? "1 jour" : `${joursRestants} jours`;
        message = `cc, vous allez bien j'espère. je tiens à vous informer que votre abonnement ${plateforme} prend fin dans ${nbJoursTxt} et profite de l'occasion pour demander si vous souhaiter renouveler. Merci`;
    }

    return `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
}

// 1. Charger le résumé financier (Dashboard)
async function chargerFinances() {
    try {
        const res = await fetch('/api/finances/resume');
        const data = await res.json();
        
        document.getElementById('total-revenus').innerText = `${data.totalRevenus || 0} FCFA`;
        document.getElementById('total-couts').innerText = `${data.totalCoutsAchat || 0} FCFA`;
        document.getElementById('benefice-brut').innerText = `${data.beneficeBrut || 0} FCFA`;
        document.getElementById('total-depenses-perso').innerText = `${data.totalDepensesPerso || 0} FCFA`;
        document.getElementById('solde-net').innerText = `${data.soldeNet || 0} FCFA`;
    } catch (e) {
        console.error("Erreur finances:", e);
    }
}

// 2. Charger l'historique financier par mois
async function chargerHistorique() {
    try {
        const res = await fetch('/api/finances/historique-mensuel');
        const data = await res.json();
        
        const tbody = document.querySelector('#table-historique tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (data.historique && data.historique.length > 0) {
                data.historique.forEach(h => {
                    tbody.innerHTML += `
                        <tr style="border-bottom: 1px solid #333;">
                            <td><b>${h.mois}</b></td>
                            <td style="color: #2ed573;">${h.revenus || 0} FCFA</td>
                            <td style="color: #ff4757;">${h.couts || 0} FCFA</td>
                            <td><b>${h.benefice_brut || 0} FCFA</b></td>
                            <td style="color: #ffa502;">${h.depenses_perso || 0} FCFA</td>
                            <td style="color: ${h.benefice_net >= 0 ? '#2ed573' : '#ff4757'}; font-weight: bold;">${h.benefice_net || 0} FCFA</td>
                        </tr>`;
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#aaa;">Aucun historique disponible pour le moment.</td></tr>`;
            }
        }
    } catch (e) {
        console.error("Erreur historique mensuel:", e);
    }
}

// 3. Charger les alertes d'expiration J-3 avec Bouton Rappel WhatsApp
async function chargerAlertes() {
    try {
        const res = await fetch('/api/alertes-j3');
        const data = await res.json();
        
        const tbodyClients = document.querySelector('#table-alertes-clients tbody');
        if (tbodyClients) {
            tbodyClients.innerHTML = '';
            if (data.clientsAExpirer && data.clientsAExpirer.length > 0) {
                data.clientsAExpirer.forEach(c => {
                    let jr = c.jours_restants;
                    if (jr === undefined || jr === null) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const dateF = new Date(c.date_fin);
                        dateF.setHours(0,0,0,0);
                        jr = Math.round((dateF - today) / (1000 * 60 * 60 * 24));
                    }

                    const lienWa = genererLienWhatsApp(c.telephone, c.nom, c.plateforme, jr);

                    tbodyClients.innerHTML += `<tr style="border-bottom: 1px solid #333;">
                        <td><b>${c.nom}</b></td>
                        <td><a style="color:#00A8FF" href="${lienWa}" target="_blank">${c.telephone}</a></td>
                        <td><span style="background:#222; padding:3px 8px; border-radius:4px;">${c.plateforme}</span></td>
                        <td>${c.date_fin}</td>
                        <td>
                            <a href="${lienWa}" target="_blank" style="background-color: #25D366; color: white; padding: 5px 12px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 12px; display: inline-block;">
                                📲 Rappeler sur WhatsApp
                            </a>
                        </td>
                    </tr>`;
                });
            } else {
                tbodyClients.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Aucun client à relancer actuellement.</td></tr>`;
            }
        }

        const tbodyComptes = document.querySelector('#table-alertes-comptes tbody');
        if (tbodyComptes) {
            tbodyComptes.innerHTML = '';
            if (data.comptesAReabonner && data.comptesAReabonner.length > 0) {
                data.comptesAReabonner.forEach(c => {
                    const carteTxt = c.carte_bancaire ? `💳 ${c.carte_bancaire}` : '<span style="color:#888;">-</span>';
                    tbodyComptes.innerHTML += `<tr style="border-bottom: 1px solid #333;">
                        <td><b>${c.plateforme}</b></td>
                        <td>${c.email}</td>
                        <td>${carteTxt}</td>
                        <td>${c.date_reabonnement}</td>
                    </tr>`;
                });
            } else {
                tbodyComptes.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#aaa;">Aucun compte maître à réabonner.</td></tr>`;
            }
        }
    } catch (e) {
        console.error("Erreur alertes:", e);
    }
}

// 4. Charger les Comptes Maîtres
async function chargerComptes() {
    try {
        const res = await fetch('/api/comptes-maitres');
        const data = await res.json();
        
        const tbody = document.querySelector('#table-comptes tbody');
        const select = document.getElementById('abo-compte-maitre');
        
        if (tbody) tbody.innerHTML = '';
        if (select) select.innerHTML = '<option value="">-- Lier à un Compte Maître (Optionnel) --</option>';

        if (data.comptes) {
            data.comptes.forEach(c => {
                const totalVendu = c.total_vendu || 0;
                const beneficeCompte = totalVendu - c.cout_achat;
                const profilsUtilises = c.profils_utilises || 0;
                const mdpVal = c.mot_de_passe || '';
                const carteVal = c.carte_bancaire || '';
                const carteTxt = carteVal ? `💳 ${carteVal}` : '<span style="color:#888;">-</span>';

                if (tbody) {
                    tbody.innerHTML += `<tr style="border-bottom: 1px solid #333;">
                        <td><b>${c.plateforme}</b></td>
                        <td>${c.email}</td>
                        <td>${carteTxt}</td>
                        <td>${c.cout_achat} FCFA</td>
                        <td><span style="color: ${profilsUtilises >= c.max_profils ? '#ff4757' : '#2ed573'}; font-weight: bold;">${profilsUtilises} / ${c.max_profils}</span></td>
                        <td><b>${totalVendu} FCFA</b></td>
                        <td style="color: ${beneficeCompte >= 0 ? '#2ed573' : '#ff4757'}; font-weight: bold;">${beneficeCompte} FCFA</td>
                        <td>${c.date_reabonnement}</td>
                        <td>
                            <button onclick="editerCompte(${c.id}, '${c.plateforme}', '${c.email}', '${mdpVal}', '${carteVal}', ${c.cout_achat}, ${c.max_profils}, '${c.date_reabonnement}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
                            <button onclick="supprimerCompte(${c.id})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:4px;">🗑️ Suppr</button>
                        </td>
                    </tr>`;
                }
                if (select) {
                    select.innerHTML += `<option value="${c.id}">${c.plateforme} - ${c.email} (${profilsUtilises}/${c.max_profils} profils)</option>`;
                }
            });
        }
    } catch (e) {
        console.error("Erreur comptes:", e);
    }
}

async function editerCompte(id, plateforme, email, mdp, carte, cout, maxProfils, dateRenouv) {
    const nouvellePlateforme = prompt("Plateforme :", plateforme);
    if (nouvellePlateforme === null) return;
    const nouvelEmail = prompt("Email du compte :", email);
    const nouveauMdp = prompt("Mot de passe :", mdp);
    const nouvelleCarte = prompt("Carte bancaire (4 derniers chiffres) :", carte);
    const nouveauCout = prompt("Coût d'achat (FCFA) :", cout);
    const nouveauMax = prompt("Nombre de profils max :", maxProfils);
    const nouvelleDate = prompt("Date de renouvellement (AAAA-MM-JJ) :", dateRenouv);

    const payload = {
        plateforme: nouvellePlateforme,
        email: nouvelEmail,
        mot_de_passe: nouveauMdp,
        carte_bancaire: nouvelleCarte || '',
        cout_achat: parseFloat(nouveauCout) || 0,
        max_profils: parseInt(nouveauMax) || 5,
        date_reabonnement: nouvelleDate
    };

    await fetch(`/api/comptes-maitres/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    chargerComptes();
    chargerFinances();
    chargerHistorique();
    chargerAlertes();
}

async function supprimerCompte(id) {
    if (confirm("Voulez-vous vraiment supprimer ce compte maître ?")) {
        try {
            const res = await fetch(`/api/comptes-maitres/${id}`, { method: 'DELETE' });
            if (res.ok) {
                chargerComptes();
                chargerFinances();
                chargerHistorique();
                chargerAbonnes();
                chargerAlertes();
            } else {
                const data = await res.json();
                alert("Erreur : " + (data.error || "Impossible de supprimer ce compte maître."));
            }
        } catch (e) {
            console.error("Erreur lors de la suppression :", e);
            alert("Erreur de connexion avec le serveur.");
        }
    }
}

// 5. Charger les Abonnés
async function chargerAbonnes() {
    try {
        const res = await fetch('/api/abonnements');
        const data = await res.json();
        const tbody = document.querySelector('#table-abonnes tbody');
        
        if (tbody) {
            tbody.innerHTML = '';
            if (data.abonnements && data.abonnements.length > 0) {
                data.abonnements.forEach(a => {
                    const compteEmail = a.compte_email 
                        ? `<span style="color:#00a8ff; font-weight:500;">📧 ${a.compte_email}</span>` 
                        : `<span style="color:#888;">Non lié</span>`;
                    
                    const profilPin = a.profil_mot_de_passe 
                        ? `<span style="background:#333; padding:2px 6px; border-radius:4px; color:#fffa65; font-weight:bold;">🔑 ${a.profil_mot_de_passe}</span>` 
                        : '-';
                    
                    const renouvVal = a.renouvellement || 'Non';
                    let renouvColor = '#aaa';
                    if (renouvVal === 'Oui') renouvColor = '#2ed573';
                    else if (renouvVal === 'Coupé') renouvColor = '#ff4757';

                    const paiementVal = a.paiement || 'Non payé';
                    const paiementColor = paiementVal === 'Payé' ? '#2ed573' : '#ff4757';

                    const phoneClean = (a.client_telephone || '').replace(/\D/g, '');

                    tbody.innerHTML += `
                        <tr style="border-bottom: 1px solid #333;">
                            <td><b>${a.client_nom}</b></td>
                            <td><a style="color:#00A8FF" href="https://wa.me/${phoneClean}" target="_blank">${a.client_telephone}</a></td>
                            <td><span style="background:#222; padding:3px 8px; border-radius:4px;">${a.plateforme}</span></td>
                            <td>${compteEmail}</td>
                            <td>${profilPin}</td>
                            <td>${a.prix_vente} FCFA</td>
                            <td>${a.date_fin}</td>
                            <td><span style="color: ${renouvColor}; font-weight: bold;">${renouvVal}</span></td>
                            <td><span style="color: ${paiementColor}; font-weight: bold;">${paiementVal}</span></td>
                            <td>
                                <button onclick="editerAbonne(${a.id}, '${a.client_nom}', '${a.client_telephone}', '${a.plateforme}', '${a.profil_mot_de_passe || ''}', ${a.prix_vente}, '${a.date_fin}', '${renouvVal}', '${paiementVal}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
                                <button onclick="supprimerAbonne(${a.id})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:4px;">🗑️ Suppr</button>
                            </td>
                        </tr>`;
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:15px; color:#aaa;">Aucun abonné enregistré.</td></tr>`;
            }
        }
    } catch (e) {
        console.error("Erreur abonnés:", e);
    }
}

async function supprimerAbonne(id) {
    if (confirm("Voulez-vous vraiment supprimer cet abonné ?")) {
        await fetch(`/api/abonnements/${id}`, { method: 'DELETE' });
        chargerAbonnes();
        chargerFinances();
        chargerComptes();
        chargerHistorique();
    }
}

async function editerAbonne(id, nom, tel, plat, profilMdp, prix, dateFin, renouv, paiement) {
    const nouveauNom = prompt("Nom du client :", nom);
    if (nouveauNom === null) return;
    const nouveauTel = prompt("Téléphone / WhatsApp :", tel);
    const nouvellePlat = prompt("Plateforme :", plat);
    const nouveauProfilMdp = prompt("Code PIN / Mot de passe du profil :", profilMdp);
    const nouveauPrix = prompt("Prix de vente (FCFA) :", prix);
    const nouvelleDate = prompt("Date de fin (AAAA-MM-JJ) :", dateFin);
    const nouveauRenouv = prompt("Renouvellement (Oui / Non / Coupé) :", renouv);
    const nouveauPaiement = prompt("Paiement (Payé / Non payé) :", paiement);

    const payload = {
        nom: nouveauNom,
        telephone: nouveauTel,
        plateforme: nouvellePlat,
        nom_profil: nouveauNom,
        profil_mot_de_passe: nouveauProfilMdp,
        prix_vente: parseFloat(nouveauPrix) || 0,
        date_fin: nouvelleDate,
        renouvellement: nouveauRenouv || 'Non',
        paiement: nouveauPaiement || 'Non payé'
    };

    await fetch(`/api/abonnements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    chargerAbonnes();
    chargerFinances();
    chargerComptes();
    chargerHistorique();
}

async function viderToutLesAbonnes() {
    if (confirm("⚠️ ATTENTION : Voulez-vous vraiment effacer TOUS les abonnés de la base de données ?")) {
        await fetch('/api/abonnements/vider/tout', { method: 'DELETE' });
        chargerAbonnes();
        chargerFinances();
        chargerComptes();
        chargerHistorique();
        alert("Toutes les données d'abonnements ont été supprimées.");
    }
}

// 6. Charger les Dépenses Personnelles
async function chargerDepenses() {
    const tbody = document.querySelector('#table-depenses tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/depenses-personnelles');
        if (!res.ok) {
            throw new Error(`Erreur serveur HTTP ${res.status}`);
        }

        const data = await res.json();
        
        let liste = [];
        if (Array.isArray(data)) {
            liste = data;
        } else if (Array.isArray(data.depenses)) {
            liste = data.depenses;
        } else if (Array.isArray(data.data)) {
            liste = data.data;
        }

        tbody.innerHTML = '';

        if (liste.length > 0) {
            liste.forEach(d => {
                const desc = d.description || d.libelle || d.motif || 'Sans description';
                const montant = d.montant || d.montant_depense || 0;
                const dateVal = d.date_creation || d.date || d.created_at || '-';
                const id = d.id || d._id;

                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #333;">
                        <td><b>${desc}</b></td>
                        <td style="color: #ff4757; font-weight: bold;">${montant} FCFA</td>
                        <td>${dateVal}</td>
                        <td>
                            <button onclick="supprimerDepense(${id})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️ Suppr</button>
                        </td>
                    </tr>`;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#aaa;">Aucune dépense enregistrée.</td></tr>`;
        }
    } catch (e) {
        console.error("Erreur dépenses personnelles:", e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#ff4757;">Erreur lors du chargement des dépenses.</td></tr>`;
    }
}

async function supprimerDepense(id) {
    if (confirm("Voulez-vous vraiment supprimer cette dépense ?")) {
        try {
            await fetch(`/api/depenses-personnelles/${id}`, { method: 'DELETE' });
            chargerDepenses();
            chargerFinances();
            chargerHistorique();
        } catch (e) {
            console.error("Erreur lors de la suppression de la dépense:", e);
        }
    }
}

// Initialisation au chargement de la page
window.onload = () => {
    chargerFinances();
    chargerComptes();
    chargerAbonnes();
    chargerHistorique();
    chargerAlertes();
    chargerDepenses();

    const formCompte = document.getElementById('form-compte');
    if (formCompte) {
        formCompte.addEventListener('submit', async (e) => {
            e.preventDefault();
            const carteElem = document.getElementById('compte-carte');
            const payload = {
                plateforme: document.getElementById('compte-plateforme').value,
                email: document.getElementById('compte-email').value,
                mot_de_passe: document.getElementById('compte-mdp').value,
                carte_bancaire: carteElem ? carteElem.value : '',
                cout_achat: parseFloat(document.getElementById('compte-cout').value) || 0,
                max_profils: parseInt(document.getElementById('compte-places').value) || 5,
                date_reabonnement: document.getElementById('compte-date').value
            };
            await fetch('/api/comptes-maitres', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            document.getElementById('msg-compte').innerText = "Compte enregistré !";
            document.getElementById('msg-compte').style.color = "#00ff00";
            e.target.reset();
            chargerComptes();
            chargerFinances();
            chargerHistorique();
            chargerAlertes();
        });
    }

    const formAbonne = document.getElementById('form-abonne');
    if (formAbonne) {
        formAbonne.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const compteMaitreVal = document.getElementById('abo-compte-maitre').value;
            const clientNom = document.getElementById('abo-nom').value;

            const payload = {
                nom: clientNom,
                telephone: document.getElementById('abo-tel').value,
                plateforme: document.getElementById('abo-plateforme').value,
                compte_maitre_id: compteMaitreVal ? parseInt(compteMaitreVal) : null,
                nom_profil: clientNom,
                profil_mot_de_passe: document.getElementById('abo-profil-mdp').value,
                prix_vente: parseFloat(document.getElementById('abo-prix').value) || 0,
                date_fin: document.getElementById('abo-date-fin').value,
                renouvellement: document.getElementById('abo-renouvellement').value,
                paiement: document.getElementById('abo-paiement').value
            };
            
            try {
                const response = await fetch('/api/abonnements', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok) {
                    document.getElementById('msg-abonne').innerText = "Vente enregistrée avec succès !";
                    document.getElementById('msg-abonne').style.color = "#2ed573";
                    e.target.reset();
                    
                    chargerAbonnes();
                    chargerFinances();
                    chargerComptes();
                    chargerHistorique();
                    chargerAlertes();
                } else {
                    console.error("Erreur serveur:", result);
                    document.getElementById('msg-abonne').innerText = "Erreur : " + (result.error || "Enregistrement échoué");
                    document.getElementById('msg-abonne').style.color = "#ff4757";
                }
            } catch (err) {
                console.error("Erreur réseau:", err);
                document.getElementById('msg-abonne').innerText = "Erreur de connexion au serveur.";
                document.getElementById('msg-abonne').style.color = "#ff4757";
            }
        });
    }

    const formDepense = document.getElementById('form-depense');
    if (formDepense) {
        formDepense.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('msg-depense');

            const payload = {
                description: document.getElementById('depense-desc').value,
                montant: parseFloat(document.getElementById('depense-montant').value) || 0
            };

            try {
                const response = await fetch('/api/depenses-personnelles', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    if (msgEl) {
                        msgEl.innerText = "Dépense enregistrée !";
                        msgEl.style.color = "#2ed573";
                    }
                    e.target.reset();
                    await chargerDepenses();
                    await chargerFinances();
                    await chargerHistorique();
                } else {
                    const errData = await response.json().catch(() => ({}));
                    if (msgEl) {
                        msgEl.innerText = "Erreur serveur : " + (errData.error || response.statusText);
                        msgEl.style.color = "#ff4757";
                    }
                }
            } catch (err) {
                console.error("Erreur réseau / serveur :", err);
                if (msgEl) {
                    msgEl.innerText = "Erreur de connexion avec le serveur.";
                    msgEl.style.color = "#ff4757";
                }
            }
        });
    }
};