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

// ----------------------------------------------------
// 1. RÉSUMÉ FINANCIER & GRAPHIQUE CHART.JS
// ----------------------------------------------------
let chartInstance = null;

async function chargerFinances() {
    try {
        const res = await fetch('/api/finances/resume');
        const data = await res.json();
        
        document.getElementById('total-revenus').innerText = `${data.totalRevenus || 0} FCFA`;
        document.getElementById('total-couts').innerText = `${data.totalCoutsAchat || 0} FCFA`;
        document.getElementById('benefice-brut').innerText = `${data.beneficeBrut || 0} FCFA`;
        document.getElementById('total-depenses-perso').innerText = `${data.totalDepensesPerso || 0} FCFA`;
        document.getElementById('solde-net').innerText = `${data.soldeNet || 0} FCFA`;

        chargerGraphiqueBenefices();
    } catch (e) {
        console.error("Erreur finances:", e);
    }
}

async function chargerGraphiqueBenefices() {
    try {
        const res = await fetch('/api/abonnements');
        const data = await res.json();
        const abos = data.abonnements || [];

        const benefsParPlateforme = {};
        let totalBeneficesGlobal = 0;

        abos.forEach(a => {
            const plat = a.plateforme || 'Autre';
            const prix = parseFloat(a.prix_vente) || 0;
            benefsParPlateforme[plat] = (benefsParPlateforme[plat] || 0) + prix;
            totalBeneficesGlobal += prix;
        });

        const labels = Object.keys(benefsParPlateforme);
        const valeurs = Object.values(benefsParPlateforme);
        const backgroundColors = ['#00a8ff', '#9b59b6', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c', '#34495e'];

        const canvasEl = document.getElementById('chartBenefices');
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        
        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => {
                    const montant = benefsParPlateforme[l];
                    const pct = totalBeneficesGlobal > 0 ? ((montant / totalBeneficesGlobal) * 100).toFixed(1) : 0;
                    return `${l} (${montant.toLocaleString()} FCFA - ${pct}%)`;
                }),
                datasets: [{
                    data: valeurs,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderWidth: 1,
                    borderColor: '#121826'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#d1d5db', font: { size: 12 } }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Erreur graphique:", err);
    }
}

// ----------------------------------------------------
// 2. HISTORIQUE MENSUEL
// ----------------------------------------------------
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

// ----------------------------------------------------
// 3. ALERTES D'EXPIRATION
// ----------------------------------------------------
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

// ----------------------------------------------------
// 4. COMPTES MAÎTRES & JAUGE DE CAPACITÉ
// ----------------------------------------------------
let tousLesComptesMaitres = [];

async function chargerComptes() {
    try {
        const res = await fetch('/api/comptes-maitres');
        const data = await res.json();
        tousLesComptesMaitres = data.comptes || [];
        
        filtrerComptesMaitres();
        chargerComptesPourSelect();
    } catch (e) {
        console.error("Erreur comptes:", e);
    }
}

function filtrerComptesMaitres() {
    const selectFiltre = document.getElementById('filtre-plateforme');
    const categorieChoisie = selectFiltre ? selectFiltre.value : 'TOUS';
    const tbody = document.querySelector('#table-comptes tbody');
    
    if (!tbody) return;
    tbody.innerHTML = '';

    const comptesFiltres = tousLesComptesMaitres.filter(c => {
        if (categorieChoisie === 'TOUS') return true;
        return c.plateforme === categorieChoisie;
    });

    if (comptesFiltres.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#aaa;">Aucun compte trouvé pour ce service.</td></tr>`;
        return;
    }

    comptesFiltres.forEach(c => {
        const totalVendu = c.total_vendu || 0;
        const beneficeCompte = totalVendu - c.cout_achat;
        const profilsUtilises = parseInt(c.profils_utilises) || 0;
        const maxProfils = parseInt(c.max_profils) || 5;
        const placesDisponibles = Math.max(0, maxProfils - profilsUtilises);

        let jaugeHTML = '';
        for (let i = 0; i < maxProfils; i++) {
            jaugeHTML += (i < profilsUtilises) ? '█' : '░';
        }
        const texteJauge = `[${jaugeHTML}] ${profilsUtilises}/${maxProfils} (${placesDisponibles} dispo)`;

        const mdpVal = c.mot_de_passe || '';
        const carteVal = c.carte_bancaire || '';
        const carteTxt = carteVal ? `💳 ${carteVal}` : '<span style="color:#888;">-</span>';

        tbody.innerHTML += `<tr style="border-bottom: 1px solid #333;">
            <td>
                <b>${c.plateforme}</b><br>
                <small style="color:#00a8ff; font-family:monospace; font-weight:bold;">${texteJauge}</small>
            </td>
            <td>${c.email}</td>
            <td>${carteTxt}</td>
            <td>${c.cout_achat} FCFA</td>
            <td><b>${totalVendu} FCFA</b></td>
            <td style="color: ${beneficeCompte >= 0 ? '#2ed573' : '#ff4757'}; font-weight: bold;">${beneficeCompte} FCFA</td>
            <td>${c.date_reabonnement}</td>
            <td>
                <button onclick="editerCompte(${c.id}, '${c.plateforme}', '${c.email}', '${mdpVal}', '${carteVal}', ${c.cout_achat}, ${maxProfils}, '${c.date_reabonnement}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
                <button onclick="supprimerCompte(${c.id})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:4px;">🗑️ Suppr</button>
            </td>
        </tr>`;
    });
}

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

// ----------------------------------------------------
// 5. ABONNÉS, RECHERCHE DYNAMIQUE & RENOUVELLEMENT 1 CLIC
// ----------------------------------------------------
let tousLesAbonnes = [];
let tousLesComptesMaitresPourFiltre = [];

async function chargerAbonnes() {
    try {
        const [resAbo, resCompte] = await Promise.all([
            fetch('/api/abonnements'),
            fetch('/api/comptes-maitres')
        ]);
        const dataAbo = await resAbo.json();
        const dataCompte = await resCompte.json();

        tousLesAbonnes = dataAbo.abonnements || [];
        tousLesComptesMaitresPourFiltre = dataCompte.comptes || [];
        
        mettreAJourFiltreEmails();
        filtrerAbonnes();
    } catch (e) {
        console.error("Erreur abonnés:", e);
    }
}

function onChangementServiceAbonnes() {
    mettreAJourFiltreEmails();
    filtrerAbonnes();
}

function mettreAJourFiltreEmails() {
    const selectService = document.getElementById('filtre-abo-plateforme');
    const selectEmail = document.getElementById('filtre-abo-email');
    if (!selectService || !selectEmail) return;

    const serviceChoisi = selectService.value;
    const valeurEmailActuelle = selectEmail.value;

    let comptesConcernes = tousLesComptesMaitresPourFiltre;
    if (serviceChoisi !== 'TOUS') {
        comptesConcernes = tousLesComptesMaitresPourFiltre.filter(c => c.plateforme === serviceChoisi);
    }

    const emailsUniques = [...new Set(comptesConcernes.map(c => c.email).filter(Boolean))];

    selectEmail.innerHTML = '<option value="TOUS">Tous les emails / Non liés</option>';
    emailsUniques.forEach(email => {
        selectEmail.innerHTML += `<option value="${email}">📧 ${email}</option>`;
    });

    if ([...selectEmail.options].some(opt => opt.value === valeurEmailActuelle)) {
        selectEmail.value = valeurEmailActuelle;
    } else {
        selectEmail.value = 'TOUS';
    }
}

// Recherche instantanée et filtrage combiné (corrigé pour l'email)
function filtrerAbonnes() {
    const texteRecherche = (document.getElementById('input-recherche')?.value || "").toLowerCase().trim();
    const serviceChoisi = document.getElementById('filtre-abo-plateforme')?.value || 'TOUS';
    const emailSelectValue = document.getElementById('filtre-abo-email')?.value || 'TOUS';
    
    // Nettoyer l'émoji et les espaces de l'email sélectionné dans le menu déroulant
    const emailChoisi = emailSelectValue !== 'TOUS' ? emailSelectValue.replace('📧', '').trim() : 'TOUS';

    const tbody = document.querySelector('#table-abonnes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const abonnementsFiltres = tousLesAbonnes.filter(a => {
        const nom = (a.client_nom || "").toLowerCase();
        const tel = (a.client_telephone || "").toLowerCase();
        const plat = (a.plateforme || "").toLowerCase();

        const matchTexte = !texteRecherche || nom.includes(texteRecherche) || tel.includes(texteRecherche) || plat.includes(texteRecherche);
        const matchService = (serviceChoisi === 'TOUS' || a.plateforme === serviceChoisi);
        
        let matchEmail = true;
        if (emailChoisi !== 'TOUS') {
            matchEmail = (a.compte_email && a.compte_email.trim().toLowerCase() === emailChoisi.toLowerCase());
        }

        return matchTexte && matchService && matchEmail;
    });

    if (abonnementsFiltres.length > 0) {
        abonnementsFiltres.forEach(a => {
            const compteEmail = a.compte_email 
                ? `<span style="color:#00a8ff; font-weight:500;">📧 ${a.compte_email}</span>` 
                : `<span style="color:#888;">Non lié</span>`;
            
            const profilPin = a.profil_mot_de_passe 
                ? `<span style="background:#333; padding:2px 6px; border-radius:4px; color:#fffa65; font-weight:bold;">🔑 ${a.profil_mot_de_passe}</span>` 
                : '-';

            let badgePaiement = '';
            if (a.paiement === 'Payé') {
                badgePaiement = '<span style="background: rgba(46,204,113,0.2); color: #2ecc71; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">🟢 Payé</span>';
            } else if (a.paiement === 'En attente') {
                badgePaiement = '<span style="background: rgba(241,196,15,0.2); color: #f1c40f; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">🟠 En attente</span>';
            } else {
                badgePaiement = '<span style="background: rgba(231,76,60,0.2); color: #e74c3c; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">🔴 Expiré/Non payé</span>';
            }

            const phoneClean = (a.client_telephone || '').replace(/\D/g, '');
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
                    <td><b>${a.date_fin}</b></td>
                    <td>${badgePaiement}</td>
                    <td>
                        <button onclick="renouvelerAbonnement(${a.id})" class="btn-sm" style="background: #00a8ff; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;" title="Cliquez pour ajouter +30 jours">🔄 Renouveler</button>
                    </td>
                    <td>
                        <button onclick="preparerEditionAbonne(${a.id}, '${clientNomSafe}', '${clientTelSafe}', '${a.plateforme}', ${a.compte_maitre_id || 'null'}, '${profilMdpSafe}', ${a.prix_vente}, '${a.date_fin}', '${a.renouvellement || 'Non'}', '${a.paiement || 'Payé'}')" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
                        <button onclick="supprimerAbonne(${a.id})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:4px;">🗑️ Suppr</button>
                    </td>
                </tr>`;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:15px; color:#aaa;">Aucun abonné trouvé avec ces filtres.</td></tr>`;
    }
}

// Fonction de renouvellement en 1 clic (+30 jours)
async function renouvelerAbonnement(id) {
    try {
        const res = await fetch(`/api/abonnements/${id}/renouveler`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            chargerAbonnes();
            chargerFinances();
            chargerAlertes();
            chargerHistorique();
        } else {
            alert("Erreur lors du renouvellement : " + (data.error || 'Erreur inconnue'));
        }
    } catch (err) {
        console.error("Erreur renouvellement 1 clic:", err);
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

    chargerComptesPourSelect(compteMaitreId);

    document.getElementById('form-abonne-titre').innerText = "Modifier l'abonné / la vente";
    document.getElementById('btn-submit-abonne').innerText = "Mettre à jour l'abonné";
    document.getElementById('btn-cancel-edit').style.display = "block";

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

// ----------------------------------------------------
// 6. DÉPENSES PERSONNELLES
// ----------------------------------------------------
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

// ----------------------------------------------------
// INITIALISATION AU CHARGEMENT DE LA PAGE
// ----------------------------------------------------
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
                    response = await fetch(`/api/abonnements/${abonId}`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });
                } else {
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