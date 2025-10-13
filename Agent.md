But de l'outil

Expresso Decision Assistant — outil d'aide à la décision préflop pour le format Expresso Nitro.
L'objectif principal est d'afficher, pour une main donnée et des paramètres de table (profondeur en BB, nombre de joueurs, position du hero), les décisions préflop recommandées selon différents scénarios (FirstIn, VsOpen, VsShove). Les décisions sont basées sur des tables de ranges (JSON).

Format du jeu et paramètres

- Format ciblé : Expresso Nitro
- Paramètres user-configurables :
  - Profondeur (depth) : 5..15 (bb)
  - Nombre de joueurs (players) : 2 ou 3
  - Position hero : BTN | SB | BB
  - Main hero : format carte lettre + suit minuscule ex: AhKs -> normalisé en AKO / AKo etc.
  - Cartes board : (futur) flop/turn/river

Décisions

- Scénarios : FirstIn, VsOpen, VsShove
- Pour préflop, l'outil doit afficher toutes les décisions pour tous les villain possibles (les positions autres que hero) et pour tous les scénarios — sans demander au user de fournir explicitement le villain ni le scénario.
- Les valeurs des actions peuvent être des chaînes ("fold", "call", "raise", "shove"), des objets poids (ex: {"fold":40, "raise":60}) ou des chaînes pourcentuelles ("40%fold/60%raise"). L'engine normalise et échantillonne selon la distribution.

Etat actuel du projet (résumé technique)

Fichiers clés:
- src/cli.ts : CLI principal — accepte players, depth, position, hand, show-range, profile et list-profiles. Affiche les décisions pour FirstIn, VsOpen et VsShove pour tous les villains.
- src/DecisionEngine.ts : moteur de décision qui transforme une DecisionValue (string/object) en une action et distribution probabiliste.
- src/ranges/RangeRepository.ts : lecture et validation des fichiers de ranges JSON. Méthodes: fromFile, fromObject, find, getPositionNode.
- src/profiles/ProfileManager.ts : utilitaires pour lister et charger des profils depuis data/profiles.
- data/preflop.ranges.json et data/profiles/* : sources de ranges (GTO/Exploit, etc.)
- public/ et src/server.ts : point de départ pour une UI web (serveur Express minimal + front statique déjà présents mais à compléter).

Notes historiques / décisions de conception

- Nous utilisons TypeScript, compilation via `tsc -p tsconfig.json`.
- Le CLI doit afficher toutes les décisions pertinentes, donc il ne faut pas exposer `--villain` ni `--scenario` comme paramètres d'usage courant (le CLI actuel ne nécessite plus ces options et les calcule automatiquement).
- Les modifications demandent que les fichiers modifiés soient fournis en entier quand on les change (pour faciliter le copier/coller). Respecté depuis les dernières modifications.

Comment reprendre le travail

Commandes utiles:
- Installer dépendances: `npm install`
- Compiler: `npm run build`
- Lancer un exemple CLI: `npm run test` (exécute une seule invocation CLI comme défini dans package.json)
- Lancer le serveur web (build + start):
  - `npm run build && npm run start:web` (si `dist/server.js` existe)
  - en dev: `npm run dev:web` pour lancer `ts-node src/server.ts` (nécessite ts-node)

Notes pour le développeur suivant

- Quand tu veux relancer le serveur qui tourne déjà, demande à l'OP de l'arrêter proprement si besoin; l'agent peut exécuter les commandes mais doit avertir.
- Les profils de ranges se trouvent dans `data/profiles`. Deux profils initiaux prévus: `gto.json` et `exploit.json`.
- Tests unitaires existent sous `src/tests` (fichiers .ts). Ils s'exécutent avec `ts-node` via le script `test:unit`.

Prochaines priorités recommandées

1. Implémenter une API HTTP (POST /api/decide) qui accepte les mêmes paramètres que le CLI et renvoie le JSON des décisions (utiliser `DecisionEngine` et `RangeRepository`).
2. UI minimale (single page) avec:
   - formulaire pour players/depth/position/hand et dropdown pour choisir le profil (liste dynamique via /api/profiles)
   - affichage des décisions (FirstIn, VsOpen, VsShove) et option pour montrer la range complète
   - bouton pour télécharger/charger un profil (future feature)
3. Éditeur de ranges (futur): interface pour modifier et sauvegarder des profils dans `data/profiles`.
4. Ajouter tests unitaires pour `DecisionEngine` (échantillonnage, parsing) et `RangeRepository` (validation, recherche de closestDepthKey).

Conventions et style

- Tous les changements TS doivent compiler sans erreurs (`npm run build`). Après modifications, exécuter `npm run build` puis lancer des tests manuels.
- Préfère modifications small + tests rapides. Quand tu fais des edits majeurs, crée les tests correspondants.

Contact / historique

- Dernier état: CLI et DecisionEngine fonctionnels. ProfileManager ajouté. Prochaine tâche proposée: exposer API et UI.



