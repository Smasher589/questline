/* =====================================================================
   Questline — notes de version
   À compléter à chaque changement : la version la plus récente en premier.
   Chaque entrée : version, date (AAAA-MM-JJ), titre, puis des listes « new » (nouveautés), « fix » (corrections), « change ».
   ===================================================================== */
const CHANGELOG = [
  { v: "2.20.0", date: "2026-11-12", title: "Audit de sécurité", new: [
      "Clés d'API (SteamGridDB, Steam) chiffrées par le coffre de Windows au lieu d'être enregistrées en clair ; les clés déjà saisies sont migrées automatiquement.",
      "Electron 44.11.1 (derniers correctifs de sécurité de Chromium) et verrous de l'exécutable activés : pas d'exécution en mode Node, pas d'options de débogage, intégrité de l'archive de l'appli vérifiée au démarrage.",
      "Outils de développement désactivés dans la version installée.",
    ], fix: [
      "Les programmes système (reg, tasklist, PowerShell) sont appelés par leur chemin complet dans Windows\\System32, jamais depuis le dossier courant.",
      "Le serveur local refuse tout s'il n'a pas de jeton, ne renvoie plus de chemins de fichiers dans ses erreurs et borne la taille de ce qu'il reçoit.",
      "Réglages et textes enregistrés validés et bornés (heure limite, jeux installés, règle d'achat, plateforme, histoire).",
      "Téléchargements plafonnés en taille, sans redirection vers une adresse non sécurisée ; jaquettes acceptées seulement depuis les sources connues.",
      "Protection contre la pollution de prototype (comptes et fichier d'état), dossiers de sauvegarde mieux contrôlés.",
    ] },
  { v: "2.19.0", date: "2026-11-12", title: "Notes de version, crédits et barre latérale", new: [
      "Notes de version en frise chronologique : la dernière version est ouverte, les autres se déplient d'un clic, avec le nombre de nouveautés et de corrections de chacune.",
      "Recherche dans les notes et filtres Nouveautés / Corrections, plus les boutons « Tout déplier » et « Tout replier ».",
      "Crédits : nouvelle section « Dessiné pour Questline » avec la pièce de crédits et l'écusson de rang en pixel art.",
    ], fix: [
      "La carte de profil en bas de la barre latérale est retirée : ton profil reste en haut à droite, sans doublon. L'état du bouclier prend sa place.",
      "La carte de profil en double dans Paramètres est aussi retirée.",
      "Crédits : titre et pastilles d'auteur sans dégradé arc-en-ciel.",
    ] },
  { v: "2.18.0", date: "2026-11-12", title: "Paramètres plus clairs", new: [
      "Recherche de réglage : tape un mot (« son », « strict », « décor »…) pour ne voir que les réglages concernés, toutes sections confondues.",
      "Nouveau réglage « Heure limite des sessions » (22 h, 23 h, minuit ou aucune) dans Quête et bouclier : avant, il n'était réglable que depuis Ma quête.",
      "Nouveau bouton « Réinitialiser l'affichage de la bibliothèque » (tri, vue et taille des jaquettes).",
      "« Revoir le guide de démarrage » t'emmène directement dans Sources.",
    ], fix: [
      "Interrupteurs et sélecteurs sans dégradé arc-en-ciel animé ni halo : un violet calme, dans toute l'app.",
      "Onglet actif, titres de section et bouton « Gérer » aux couleurs calmes au lieu du rose néon.",
    ] },
  { v: "2.17.0", date: "2026-11-12", title: "Sources repensées et premier lancement plus clair", new: [
      "Premier lancement : tant qu'aucun lanceur n'est relié, les menus sont grisés avec un cadenas. Sources, Paramètres, Notes de version et Crédits restent ouverts.",
      "Un clic sur un menu verrouillé explique quoi faire au lieu d'afficher une autre page sans prévenir.",
      "Guide en 3 étapes en haut de Sources (relier un lanceur, retrouver tes jeux, ouvrir tous les menus) avec un bouton « Terminer et ouvrir Questline ».",
      "Cartes de lanceur claires : état (relié, non relié, introuvable sur ce PC) et nombre de jeux en un coup d'œil.",
      "Émulateurs en cartes (console, émulateur, nombre de jeux, chemins) et ajout guidé en 3 étapes : console et émulateur, programme, dossiers de jeux.",
      "« Jeux ajoutés à la main » et « Jaquettes » regroupés dans « Autres sources ».",
    ], fix: [
      "Corrigé : après l'installation, cliquer sur n'importe quel menu affichait la page des comptes sans explication.",
    ] },
  { v: "2.16.0", date: "2026-11-12", title: "Écusson pixel art et 43 nouveaux badges", new: [
      "Nouvel écusson de rang en pixel art : contour sombre, bord métallique à la couleur de ton rang, gemme et niveau en chiffres pixelisés. Il apparaît sur la page Badges, ta carte de rang et l'annonce de passage de niveau.",
      "43 nouveaux badges, de « Trilogie personnelle » (3 jeux finis) à « Panthéon » (50 jeux), « Roi des succès » (20 jeux à 100 %) ou « Rituel sacré » (60 jours d'affilée). Il y en a maintenant 84.",
      "Nouveaux thèmes de badges : jours joués, mois actifs, week-ends, nuits blanches, succès cumulés, jeux lancés, émulation, sagas, jeux courts ou longs, notes Metacritic, achats mérités, liste de souhaits et file d'attente.",
      "Les badges déjà mérités par tes données sont débloqués automatiquement, avec leur XP.",
    ] },
  { v: "2.15.0", date: "2026-11-12", title: "Badges & défis repensés", new: [
      "Carte de rang plus lisible : barre d'XP vers le niveau suivant (avec l'XP restante) et échelle des 9 rangs.",
      "Défis du mois en cartes claires : icône, barre de progression, état « Réussi » et bonus d'XP.",
      "Nouvelle section « Presque débloqués » : les 4 badges ou paliers les plus proches, avec ce qu'il te reste à faire.",
      "Onglets Badges / Succès à paliers / D'où vient ton XP : la page est beaucoup plus courte.",
      "Badges regroupés par rareté avec le compte obtenus / total, paliers avec une jauge de 12 crans, détail de l'XP en barres.",
    ], fix: [
      "Plus de barre d'XP arc-en-ciel ni de rose néon : couleurs calmes, à la couleur de ton rang.",
      "Les cartes de paliers n'affichent plus deux barres de progression qui se répètent.",
    ] },
  { v: "2.14.0", date: "2026-11-12", title: "Statistiques repensées", new: [
      "Bandeau de chiffres clés : jeux terminés (et à 100 %), temps total et de l'année, temps et jours joués ce mois-ci, série en cours et record.",
      "Backlog en barre empilée (terminés / commencés / jamais lancés) avec un conseil pour le faire baisser.",
      "Progression : barre d'XP vers le niveau suivant, badges et tentations résistées ce mois.",
      "Calendrier d'activité lisible : mois et jours de la semaine, légende, jours joués, plus grosse journée et moyenne par jour joué.",
      "Genres préférés exprimés en part de ton temps de jeu, nouvelle carte « Tes plateformes » et top 8 des jeux les plus joués avec jaquette, succès ou mention « Terminé ».",
    ], fix: [
      "Fini les halos roses et le néon : une palette plus calme (violet doux, or pour les jeux finis).",
      "Le graphique mensuel affiche les heures au-dessus de chaque mois.",
    ] },
  { v: "2.13.0", date: "2026-11-12", title: "Palmarès : la salle des trophées", new: [
      "Podium Or / Argent / Bronze avec les coupes itch.io : or pour les jeux à 100 %, argent pour l'histoire terminée, bronze pour les jeux validés avec Questline. Clique sur une marche pour filtrer.",
      "Résumé de tes exploits : jeux terminés, succès débloqués et heures passées sur ces jeux.",
      "« Dernier exploit » mis en avant avec la grande image du jeu, sa fin, son temps de jeu et ses succès.",
      "Nouvelle section « À portée du 100 % » : les jeux où il te reste le moins de succès pour décrocher l'or.",
      "Vitrine filtrable : chaque jeu a sa coupe, sa barre de succès, son temps de jeu, sa date et sa note Metacritic.",
    ], fix: [
      "Un jeu n'apparaît plus deux fois quand il est à la fois validé dans Questline et terminé sur Steam : il garde son meilleur rang.",
      "Le scan des succès Steam est rangé en bas de page, dans un encadré plus discret.",
    ] },
  { v: "2.12.1", date: "2026-11-12", title: "Pièce de crédits en pixel art", new: [
      "Nouvelle pièce dorée dessinée en pixel art (16×16) dans le style des packs itch.io : elle flotte doucement et tourne sur elle-même au survol.",
      "Sans crédit, la pièce devient grise.",
    ], fix: [
      "Le nombre de crédits ne se superpose plus au symbole de la pièce : il est affiché dans un badge « ×1 » bien lisible.",
    ] },
  { v: "2.12.0", date: "2026-11-12", title: "Liste de souhaits repensée", new: [
      "Nouveau portefeuille de crédits : pièce dorée avec ton nombre de crédits, étapes vers le prochain crédit, jeux finis, crédits gagnés et dépensés.",
      "Recherche sur le magasin Steam avec la touche Entrée et résultats en cartes (grande image, prix, « déjà possédé »).",
      "Tes envies en cartes : prix, date d'ajout, bouton Acheter ou nombre de jeux restant à finir.",
    ], fix: [
      "Fini le cadre jaune « CRÉDITS » peu lisible.",
      "Images des jeux nettes (bannières en grand format au lieu de vignettes floues).",
    ] },
  { v: "2.11.0", date: "2026-11-12", title: "Bibliothèque repensée", new: [
      "Barre d'outils toujours visible : recherche, tri (joués récemment, nom, temps de jeu, Metacritic, avis, plus courts, plus longs) et affichage.",
      "Filtres combinables avec le nombre de jeux : statut (à finir, déjà joués, jamais lancés, terminés, installés), plateforme (Steam, Epic, chaque console émulée…) et durée (courts, moyens, longs).",
      "Vue liste détaillée : statut, temps joué, durée, succès, Metacritic et dernière session.",
      "Trois tailles de jaquettes (S, M, L) ; tes réglages d'affichage sont mémorisés.",
    ] },
  { v: "2.10.1", date: "2026-11-12", title: "Correctif d'affichage", fix: [
      "File d'attente : les icônes du résumé débordaient de leur carré.",
      "Garde-fou : les icônes restent centrées dans leurs carrés sur toutes les pages.",
    ] },
  { v: "2.10.0", date: "2026-11-12", title: "File d'attente repensée", new: [
      "Planning de tes prochaines quêtes : ta quête en cours puis chaque jeu de la file, avec ses dates de début et de fin estimées à ton rythme de jeu réel.",
      "Résumé : places occupées, heures d'histoire à jouer, ton rythme par semaine et date de fin de toute la file.",
      "Réorganise la file par glisser-déposer (ou avec les flèches) ; les places libres s'affichent pour ajouter un jeu.",
      "Suggestions pour ta file : des jeux bien notés, courts ou déjà commencés, ajoutables en un clic.",
    ] },
  { v: "2.9.1", date: "2026-11-12", title: "Petites finitions", fix: [
      "La flèche des liens « Passer », « Modifier la durée »… est maintenant alignée sur le texte.",
    ] },
  { v: "2.9.0", date: "2026-11-12", title: "Plus de réponses aux questions", new: [
      "58 nouvelles réponses (148 au lieu de 90) suite à vos retours : chaque question propose maintenant 4 à 10 choix.",
      "Rythme : 1 h ou 10 h par semaine. Objectif : un week-end, une semaine, plus de 3 mois.",
      "Envie : les personnages, construire et gérer, réfléchir, la tactique, la vitesse.",
      "Abandon : combats lassants, décrochage après une pause, jeu trop dur à regarder, trop compliqué à prendre en main.",
      "Plateforme : Steam, Epic/GOG/Ubisoft ou Switch. Difficulté : très facile ou réglable. Époque : tout récent, années 2000, rétro.",
      "Et de nouvelles ambiances, émotions, vues, univers, styles, combats, héros (dont une héroïne) et choix d'équipe.",
      "Touche 0 pour la 10e réponse.",
    ] },
  { v: "2.8.1", date: "2026-11-12", title: "Jaquette par défaut", new: [
      "Les jeux sans image (comme Spacewar) ont une jaquette par défaut : couleur propre au jeu, motif discret, manette en filigrane et nom du jeu.",
      "Bannière de secours aux mêmes couleurs dans la fiche du jeu et dans Ma quête.",
    ], fix: [
      "Un jeu Steam sans jaquette n'affiche plus un emplacement vide.",
      "Une note Metacritic absente s'affiche « — » au lieu de « 0 ».",
    ] },
  { v: "2.8.0", date: "2026-11-12", title: "Jaquettes et top 5 plus nets", change: [
      "Nouvelles jaquettes sur tout le site (inspirées d'itch.io) : coins nets, badges discrets avec pastille de couleur, note Metacritic en coin et infos au survol (durée, avis, succès).",
      "Top 5 : pourcentage d'affinité en grand et coloré, bien lisible sur chaque jaquette.",
      "Barres de progression sobres : couleur unie, sans dégradé arc-en-ciel ni halo.",
    ], fix: [
      "Cliquer sur un jeu du top 5 ne relance plus l'animation de toutes les cartes : seule la sélection et le détail changent.",
      "Plus de reflet lumineux qui balaie les jaquettes au survol.",
    ] },
  { v: "2.7.0", date: "2026-11-12", title: "Choisir ma quête, repensé", new: [
      "Questions : aperçu en direct des jeux en tête au fil de tes réponses, raccourcis clavier (1 à 9, retour arrière, flèches) et temps restant estimé.",
      "Top 5 : cartes lisibles avec rang, pourcentage et note Metacritic, et détail « Pourquoi ce score » critère par critère.",
      "Accueil : ta pile de jeux à finir (courts, moyens, longs, déjà commencés), suites de saga en attente et accès à tes derniers résultats.",
    ], change: [
      "Fini les cartes néon retournables : un design plus sobre et plus lisible.",
    ] },
  { v: "2.6.0", date: "2026-11-12", title: "Notes, avis et commandes", new: [
      "Nouvelle fiche de jeu : grande bannière, jaquette, notes en couleur, informations, succès et notes de la presse.",
      "Notes partout : Metacritic, avis des joueurs Steam et moyenne de la presse, sur la fiche, dans Ma quête et en badge sur les jaquettes de la bibliothèque.",
      "10 avis par jeu, positifs et avec réserves mélangés et filtrables : joueurs Steam, complétés par les critiques de la presse (via Wikipédia).",
      "Les jeux émulés et hors Steam ont aussi leurs notes et avis de presse.",
      "Commandes conseillées : manette ou clavier-souris, selon le jeu et la plateforme.",
    ] },
  { v: "2.5.0", date: "2026-11-12", title: "Sessions maîtrisées", new: [
      "Objectif de session repensé : durée réglable au quart d'heure (boutons −/+, curseur, choix rapides de 30 min à 3 h), heure de fin affichée en direct.",
      "Heure limite (22 h, 23 h, minuit ou aucune) : Questline t'avertit si ta session la dépasse, si tu joues en pleine nuit ou plus de 3 h d'affilée, et te demande confirmation.",
      "Session en cours : compte à rebours en anneau, bouton +15 min et rappel 10 minutes avant la fin.",
      "Page Ma quête sans quête en cours : guide « Bien démarrer », trois façons de choisir ton jeu, jeux à reprendre et prochain jeu de ta file mis en avant.",
    ], change: [
      "Bouton Jouer plus compact et plus sobre.",
      "Journal de quête plus élégant : 4 indicateurs, barres arrondies avec leur durée au survol, jour en cours mis en valeur et moyenne en pointillés.",
    ] },
  { v: "2.4.0", date: "2026-11-12", title: "Ma quête, en plus clair", change: [
      "Page Ma quête repensée comme une fiche de jeu : grande bannière avec l'illustration du jeu, jaquette, titre lisible et bouton Jouer bien visible.",
      "Nouvelle mise en page en deux colonnes : objectif de fin, progression (avec repères à 25, 50 et 75 %), journal et session à gauche ; informations, récompenses, bouclier et jeu suivant à droite.",
      "Cadres plus opaques et textes secondaires plus contrastés dans toute l'application.",
    ], fix: [
      "Fini les effets néon au survol : plus de halo de couleur qui suit la souris, plus de bordure lumineuse ni d'inclinaison 3D des jaquettes.",
    ] },
  { v: "2.3.1", date: "2026-11-12", title: "Nouveau logo", new: [
      "Nouveau logo officiel de Questline : icône de l'application, de l'installeur, de la barre des tâches, de la zone de notification et de la barre latérale.",
    ] },
  { v: "2.3.0", date: "2026-11-12", title: "Encore plus de succès", new: [
      "8 nouvelles familles de paliers : Globe-trotteur (plateformes), Marathonien (ton jeu le plus joué), Curieux (jeux lancés), Saisons de jeu (mois actifs), Collection de badges, Âme rétro (émulation), Guerrier du week-end et Grosse journée. 216 paliers au total.",
      "15 nouveaux badges : Fidèle à la saga, Rétro-gamer, Multi-plateforme, Sans retraite, Retour gagnant, Patience, Planificateur, Décorateur, Journée marathon, Week-end gamer, Millénaire, Archiviste en chef, Mille succès, Reconnaissant et Toujours à jour.",
      "Nouvelle page Crédits : chaque artiste avec un aperçu de son travail, les typographies, composants, données et technologies utilisés.",
    ], change: [
      "Page Paramètres repensée : onglets avec ta carte de profil, une section à la fois, aperçu du décor actuel et prochains déblocages, résumé de ta bibliothèque et de tes crédits d'achat.",
      "La famille « Légende des paliers » va désormais jusqu'à 200 paliers.",
    ] },
  { v: "2.2.0", date: "2026-11-12", title: "Paliers, décors et trophées", new: [
      "Succès à paliers : 10 familles de 12 paliers (jeux finis, quêtes, heures, régularité, jours de jeu, 100 %, succès débloqués, volonté, collection, et une famille « Légende » qui compte tous les autres), avec un emblème qui grandit à chaque palier et une annonce à chaque palier atteint.",
      "Décors de fond en pixel art animés en couches : nuits étoilées, forêt, crépuscule, montagnes, canyon, nébuleuses. Ils se débloquent en montant de niveau.",
      "Palettes de couleurs à débloquer (Steam au niveau 3, Rétro au niveau 5).",
      "Médailles pour les défis du mois réussis et coupe sur l'écran de victoire.",
      "Crédits des images (voir la page Crédits).",
    ], change: [
      "Le fond « aurore » d'origine devient un décor parmi d'autres ; « Nuit étoilée » est le décor par défaut.",
    ] },
  { v: "2.1.0", date: "2026-11-12", title: "Tes comptes, tes sagas, ta date de fin", new: [
      "Accueil au premier lancement : tu choisis les comptes à relier (Steam, Epic, GOG, Ubisoft Connect, Amazon). Aucun mot de passe, aucun compte relié sans ton accord.",
      "Vérification du profil : Questline indique si ton profil Steam ou Epic est public, condition pour lire tes succès en ligne.",
      "Succès Steam lus depuis ton profil public pour les jeux jamais lancés sur ce PC.",
      "Ubisoft Connect : jeux installés détectés et lancés depuis Questline.",
      "Liste complète des succès d'un jeu, avec filtres, dates, icônes et succès secrets floutés.",
      "Durée de l'histoire modifiable sur ta quête en cours.",
      "Notes de version (cette page).",
    ], change: [
      "« Ce soir » devient « Choisir ma quête », avec des questions centrées sur ce qui te fera aller jusqu'au générique : ton rythme par semaine, ton délai, ce qui t'a déjà fait abandonner, la plateforme, les sagas.",
      "Pourcentage d'affinité recalculé : une information manquante compte pour moitié au lieu de fausser le score ; la durée est comparée à ton rythme réel.",
      "Le tirage « J'ai de la chance » affiche le pourcentage d'avis positifs, plus une fausse affinité.",
      "Date de fin prévue : calculée sur ton rythme des 14 derniers jours, avec les heures restantes et le rythme hebdomadaire affichés.",
    ], fix: [
      "Une suite n'est plus proposée tant que l'épisode précédent que tu possèdes n'est pas fini (ex. Tears of the Kingdom après Breath of the Wild).",
      "Durées des jeux Switch connus (Breath of the Wild : 50 h au lieu de 16 h).",
      "Version portable : le démarrage automatique vise le bon fichier.",
    ] },
  { v: "2.0.0", date: "2026-11-11", title: "Application de bureau", new: [
      "Questline devient une vraie application pour Windows, Linux (AppImage) et macOS.",
      "Bibliothèque unifiée : Steam, Epic, GOG, Amazon, jeux ajoutés à la main et une vingtaine de consoles en émulation (Switch 1 et 2, Wii U, Wii, PlayStation 1 à 4, Xbox 360, rétro…).",
      "Jaquettes automatiques pour les jeux émulés.",
      "Page Sources pour gérer comptes, émulateurs et dossiers de jeux.",
    ], fix: [
      "Le bouclier ne touche qu'aux vrais téléchargements en cours.",
      "Serveur local protégé par jeton, polices intégrées (plus aucun appel à Google).",
    ] },
  { v: "1.2.0", date: "2026-11-10", title: "Switch et Epic", new: [
      "Jeux Switch (émulateur) dans la bibliothèque, avec jaquettes Nintendo.",
      "Succès de Breath of the Wild lus directement dans ta sauvegarde.",
      "Jeux et succès Epic Games (profil public).",
    ] },
  { v: "1.0.0", date: "2026-10-20", title: "Première version", new: [
      "Une quête à la fois : le bouclier bloque les autres téléchargements Steam tant que l'histoire n'est pas finie.",
      "Questionnaire et top 5 des jeux de ta bibliothèque.",
      "Palmarès, statistiques, badges, défis du mois et liste de souhaits.",
    ] },
];

// frise des versions : la dernière est ouverte, les autres se déplient ; recherche et filtre sans recharger la page
let notesKind = "all";
const NOTE_KINDS = [["new", "Nouveautés", "plus", "new"], ["change", "Changements", "rotate", "chg"], ["fix", "Corrections", "check", "fix"]];
const noteDate = d => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function noteCard(r, i) {
  const counts = NOTE_KINDS.map(([k, l, ic, cls]) => r[k]?.length ? `<span class="nc-count ${cls}">${icon(ic, "sm")} ${r[k].length}</span>` : "").join("");
  const major = /\.0$/.test(r.v);
  return `<details class="nrow ${major ? "major" : "minor"}" ${i === 0 ? "open" : ""} data-v="${esc(r.v)}">
    <summary>
      <span class="nr-dot"></span>
      <span class="nr-v">${esc(r.v)}</span>
      <span class="nr-t"><b>${esc(r.title)}</b><small>${noteDate(r.date)}${i === 0 ? ` · <em>version installée</em>` : ""}</small></span>
      <span class="nr-counts">${counts}</span>
      <span class="nr-chev">${icon("down", "sm")}</span>
    </summary>
    <div class="nr-body panel">${NOTE_KINDS.map(([k, l, ic, cls]) => r[k]?.length ? `<div class="nr-block" data-kind="${k}">
      <h4 class="nr-h ${cls}">${icon(ic, "sm")} ${l}</h4>
      <ul>${r[k].map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "").join("")}</div>
  </details>`;
}

function viewNotes() {
  setBackdrop(null);
  if (!st.flags?.notes) api("/api/flag", { name: "notes" }).then(s => { st = s; }).catch(() => {});
  const total = k => CHANGELOG.reduce((a, r) => a + (r[k]?.length || 0), 0);
  const first = CHANGELOG[CHANGELOG.length - 1];
  const chip = (k, l, n) => `<button class="lchip ${notesKind === k ? "on" : ""}" data-nkind="${k}">${l}<span>${n}</span></button>`;
  return `
  <div class="page-head"><div><span class="eyebrow">Quoi de neuf ?</span><h2 class="title">Notes de version</h2>
    <p class="small" style="margin-top:4px">Version installée <b>${esc(st.version || CHANGELOG[0].v)}</b> · ${CHANGELOG.length} mises à jour depuis la ${esc(first.v)} · ${total("new")} nouveautés et ${total("fix")} corrections</p></div>
    <button class="btn sm" data-go="credits">${icon("heart", "sm")} Crédits</button></div>
  <div class="ntool panel">
    <label class="lsearch">${icon("search", "sm")}<input id="nq" placeholder="Rechercher dans les notes (ex. « succès », « Epic », « jaquette »)…" autocomplete="off"></label>
    <div class="pal-chips">${chip("all", "Tout", total("new") + total("fix") + total("change"))}${chip("new", "Nouveautés", total("new"))}${chip("fix", "Corrections", total("fix"))}</div>
    <div class="row" style="gap:6px"><button class="btn xs" data-nall="1">${icon("down", "sm")} Tout déplier</button><button class="btn xs" data-nall="0">${icon("up", "sm")} Tout replier</button></div>
  </div>
  <div class="ntimeline">${CHANGELOG.map(noteCard).join("")}</div>
  <div class="sempty panel" id="nempty" hidden>${icon("search")} <span>Aucune note ne correspond à cette recherche.</span></div>`;
}

// filtre : type de note et mots recherchés ; les versions concernées s'ouvrent
function filterNotes() {
  const q = (document.querySelector("#nq")?.value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = q.split(/\s+/).filter(Boolean);
  const norm = el => el.textContent.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let shown = 0;
  document.querySelectorAll(".nrow").forEach((row, i) => {
    let inRow = 0;
    row.querySelectorAll(".nr-block").forEach(b => {
      const kindOk = notesKind === "all" || b.dataset.kind === notesKind;
      let n = 0;
      b.querySelectorAll("li").forEach(li => { const ok = kindOk && words.every(w => norm(li).includes(w) || norm(row.querySelector(".nr-t")).includes(w)); li.hidden = !ok; n += ok; });
      b.hidden = !n; inRow += n;
    });
    row.hidden = !inRow; shown += inRow;
    if (words.length || notesKind !== "all") row.open = inRow > 0; else row.open = i === 0;
  });
  document.querySelector("#nempty").hidden = shown > 0;
}

document.addEventListener("input", e => { if (e.target.id === "nq") filterNotes(); });
document.addEventListener("click", e => {
  const k = e.target.closest("[data-nkind]");
  if (k) { notesKind = k.dataset.nkind; document.querySelectorAll("[data-nkind]").forEach(b => b.classList.toggle("on", b === k)); filterNotes(); return; }
  const all = e.target.closest("[data-nall]");
  if (all) document.querySelectorAll(".nrow:not([hidden])").forEach(r => { r.open = all.dataset.nall === "1"; });
});
