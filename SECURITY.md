# Sécurité de Questline

## Signaler une faille

Merci de ne pas ouvrir d'issue publique. Utilise l'onglet **Security > Report a vulnerability** du dépôt GitHub (signalement privé). Décris la version concernée, les étapes pour reproduire et l'impact.

## Principes

- **Aucun mot de passe** : les comptes sont reliés par leur identifiant public, avec l'accord du joueur.
- **Rien n'est envoyé à un serveur de Questline** : l'appli lit les fichiers des launchers sur l'ordinateur et ne contacte que des services publics (Steam, Epic, Wikipédia, sources de jaquettes).
- **Clés d'API chiffrées** par le coffre du système (DPAPI sous Windows) via Electron `safeStorage`.

## Audit du 12 novembre 2026 (version 2.20.0)

Revue du code complète (processus principal Electron, serveur local, lanceurs de jeux, requêtes réseau, rendu de l'interface, dépendances, intégration continue), suivie des corrections et de tests automatisés.

### Indicateurs

| Indicateur | Avant | Après |
|---|---|---|
| Failles critiques / élevées | 0 / 0 | 0 / 0 |
| Failles moyennes | 2 | 0 |
| Failles faibles | 13 | 1 (acceptée) |
| Points informatifs | 7 | 2 (acceptés) |
| Contrôles réussis | 49 / 66 (74 %) | 64 / 66 (97 %) |
| Secrets ou données personnelles dans le code | 0 | 0 |
| Fichiers non désirés dans l'exécutable (`.claude`, tests, `node_modules`, données) | 0 | 0 |
| Vulnérabilités des dépendances livrées (npm audit, runtime) | 0 | 0 |
| Tests automatisés | 29 | 35 (dont 6 de sécurité) |

### Contrôles par catégorie

| Catégorie | Avant | Après |
|---|---|---|
| Durcissement Electron | 8 / 11 | 11 / 11 |
| Serveur local (jeton, Host, Origin, CSP, validation) | 12 / 16 | 16 / 16 |
| Lancement de programmes et fichiers | 9 / 11 | 11 / 11 |
| Requêtes sortantes et XSS | 9 / 12 | 12 / 12 |
| Secrets et vie privée | 5 / 6 | 6 / 6 |
| Dépendances | 1 / 3 | 2 / 3 |
| Intégration continue GitHub | 5 / 7 | 6 / 7 |

### Corrections appliquées

- Electron 44.11.1 (derniers correctifs Chromium) et **fuses** : pas de mode Node, pas de `NODE_OPTIONS` ni `--inspect`, intégrité de `app.asar` vérifiée, appli chargée uniquement depuis l'archive.
- Outils de développement désactivés dans la version installée, vérification des permissions refusée par défaut.
- Actions GitHub épinglées par empreinte de commit, Dependabot activé.
- Pollution de prototype bloquée (nom de plateforme, fichier d'état).
- Binaires système (`reg`, `tasklist`, PowerShell) appelés par leur chemin complet dans `System32`.
- Serveur local : refus total sans jeton, erreurs sans chemin de fichier, corps de requête plafonné, réglages et textes bornés, plateformes sur liste blanche.
- Téléchargements plafonnés en taille et sans redirection vers `http`, jaquettes limitées aux hôtes connus, identifiants Wikidata validés.
- Dossiers de sauvegarde : un chemin ne peut plus désigner le dossier racine lui-même.
- URL d'images filtrées avant leur insertion dans du CSS.

### Points restants (acceptés)

- `style-src 'unsafe-inline'` dans la CSP : nécessaire aux styles calculés de l'interface ; aucun script en ligne n'est autorisé (`script-src 'self'`).
- 6 alertes « modérées » de npm audit dans l'outil de construction (`minimatch` via electron-builder) : non livré dans l'appli, à mettre à jour dès qu'une version corrigée sort.
- Exécutables non signés : à signer lors d'une distribution publique.
