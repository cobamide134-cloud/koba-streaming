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
    if (tabId === 'abonnes') {
        chargerComptesPourSelect();
        chargerAbonnes();
    }
    if (tabId === 'depenses') chargerDepenses();
}

// Fonction de déconnexion
function deconnexion() {
    if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
        window.location.href = '/logout';
    }
}

// Générateur de lien WhatsApp international
function genererLienWhatsApp(telephone, nom, plateforme, joursRestants) {
    let phoneClean = (telephone || '').replace(/\D/g, '');
    if (phoneClean.length === 8) {
        phoneClean = '229' + phoneClean;
    }

    let message = "";
    if (joursRestants <= 0) {
        message = `cc, vous allez bien j'espère. je tiens à vous informer que votre abonnement a expiré. Merci`;
    } else {
        const nbJoursTxt = joursRestants === 1 ? "1 jour" : `${joursRestants} jours`;
        message = `cc, vous allez bien j'espère. je tiens à vous informer que votre abonnement ${plateforme} prend fin dans ${nbJoursTxt} et profite de l'occasion pour demander si vous souhaitez renouveler. Merci`;
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

// 3. Charger les alertes d'expiration J-3
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
        if (tbody) tbody.innerHTML = '';

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
            });
        }
        chargerComptesPourSelect();
    } catch (e) {
        console.error("Erreur comptes:", e);
    }
}

// Remplir la liste déroulante des comptes maîtres dans le formulaire abonné
async function chargerComptesPourSelect(selectedId = null) {
    try {
        const res = await fetch('/api/comptes-maitres');
        const data = await res.json();
        const select = document.getElementById('abo-compte-maitre');
        
        if (select) {
            select.innerHTML = '<option value="">-- Lier à un Compte Maître (Optionnel) --</option>';
            if (data.comptes) {
                data.comptes.forEach(c => {
                    const profilsUtilises = c.profils_utilises || 0;
                    const isSelected = selectedId && parseInt(selectedId) === parseInt(c.id) ? 'selected' : '';
                    select.innerHTML += `<option value="${c.id}" ${isSelected}>${c.plateforme} - ${c.email} (${profilsUtilises}/${c.max_profils} profils)</option>`;
                });
            }
        }
    } catch (e) {
        console.error("Erreur select comptes maîtres:", e);
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

                    // Échappement propre pour éviter les bugs de guillemets
                    const clientNomSafe = (a.client_nom || '').replace(/'/g, "\\'");
                    const clientTelSafe = (a.client_telephone || '').replace(/'/g, "\\'");
                    const profilMdpSafe = (a.profil_mot_de_passe || '').replace(/'/g, "\\'");

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
                                <button onclick="preparerEditionAbonne(${a.id}, '${clientNomSafe}', '${clientTelSafe}', '${a.plateforme}', ${a.compte_maitre_id || 'null'}, '${profilMdpSafe}', ${a.prix_vente}, '${a.date_fin}', '${renouvVal}', '${paiementVal}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
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

// Remplir le formulaire principal avec les données de l'abonné sélectionné pour édition
function preparerEditionAbonne(id, nom, tel, plateforme, compteMaitreId, profilMdp, prix, dateFin, renouv, paiement) {
    document.getElementById('abo-id').value = id;
    document.getElementById('abo-nom').value = nom;
    document.getElementById('abo-tel').value = tel;
    document.getElementById('abo-plateforme').value = plateforme;
    document.getElementById('abo-profil-mdp').value = profilMdp;
    document.getElementById('abo-prix').value = prix;
    document.getElementById('abo-date-fin').value = dateFin;
    document.getElementById('abo-renouvellement').value = renouv;
    document.getElementById('abo-paiement').value = paiement;

    // Charger et sélectionner le bon compte maître dans la liste déroulante
    chargerComptesPourSelect(compteMaitreId);

    // Modifier le titre et les boutons pour indiquer qu'on est en mode modification
    document.getElementById('form-abonne-titre').innerText = "Modifier l'abonné / la vente";
    document.getElementById('btn-submit-abonne').innerText = "Mettre à jour l'abonné";
    document.getElementById('btn-cancel-edit').style.display = "block";

    // Faire remonter la page vers le formulaire pour un meilleur confort visuel
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function annulerEditionAbonne() {
    document.getElementById('form-abonne').reset();
    document.getElementById('abo-id').value = '';
    document.getElementById('form-abonne-titre').innerText = "Nouvelle vente / Nouvel abonné";
    document.getElementById('btn-submit-abonne').innerText = "Enregistrer la vente";
    document.getElementById('btn-cancel-edit').style.display = "none";
    chargerComptesPourSelect();
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
        const data = await res.json();
        
        let liste = Array.isArray(data) ? data : (data.depenses || data.data || []);
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
            console.error("Erreur suppression dépense:", e);
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
    chargerComptesPourSelect();

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
            
            const abonId = document.getElementById('abo-id').value;
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
                let response;
                if (abonId) {
                    // Mode Modification (PUT)
                    response = await fetch(`/api/abonnements/${abonId}`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Mode Création (POST)
                    response = await fetch('/api/abonnements', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });
                }

                const result = await response.json();

                if (response.ok) {
                    document.getElementById('msg-abonne').innerText = abonId ? "Abonné mis à jour avec succès !" : "Vente enregistrée avec succès !";
                    document.getElementById('msg-abonne').style.color = "#2ed573";
                    
                    annulerEditionAbonne();
                    chargerAbonnes();
                    chargerFinances();
                    chargerComptes();
                    chargerHistorique();
                    chargerAlertes();
                } else {
                    document.getElementById('msg-abonne').innerText = "Erreur : " + (result.error || "Opération échouée");
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