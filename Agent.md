# Agent.md

But général
- Outil CLI (TypeScript / Node) pour recommander des décisions PRÉFLOP pour le format Expresso Nitro (Spin & Go courts), en configuration 2-max (heads-up) et 3-max.
- L'objectif : fournir, pour une main donnée et une profondeur (en big blinds), la décision à prendre dans tous les scénarios pré-flop pertinents (FirstIn, VsOpen, VsShove) en se basant sur des tableaux de ranges JSON.

Résumé - objectif
- CLI qui prend en entrée : nombre de joueurs (2|3), profondeur (5..15), position du héros (BTN|SB|BB), main du héros (formats permissifs : AhKs, AKs, AK, a k s, etc.).
- Pour chaque scénario préflop (FirstIn, VsOpen, VsShove) et pour chaque vilain possible (positions autres que la position du héros), l'outil affiche l'action recommandée (fold|call|raise|shove) selon les ranges.
- Si aucune donnée n'existe pour un cas, on applique un fallback conservateur : FirstIn -> fold, VsOpen -> fold, VsShove -> call.

État actuel du projet (à la date de la dernière modification)
- CLI fonctionnel : `src/cli.ts` parse les options et affiche les décisions pour FirstIn, VsOpen et VsShove pour chaque vilain.
- Normalisation des mains robuste : `src/domain.ts` contient `normalizeHandLabel` qui accepte plusieurs formats (ex: AhKs, AKs, AK, a k s) et retourne des labels standards (ex: AA, AKS, A2O).
- Chargement des ranges depuis `data/preflop.ranges.json` via `src/ranges/RangeRepository.ts` (méthode `fromFile` et `find`).
- `src/DecisionEngine.ts` encapsule la logique de décision (normalisation + lookup + fallback).
- Tests rapides en place (scripts via `ts-node`) :
  - `src/tests/normalize.test.ts` (normalisation)
  - `src/tests/range.test.ts` (RangeRepository)
  - `src/tests/decision.test.ts` (DecisionEngine)
  - Script npm `test:unit` pour exécuter tous ces tests séquentiellement.

Conventions et format des données
- `data/preflop.ranges.json` : racine par nombre de joueurs ("2", "3").
- Sous chaque nombre de joueurs : clés de profondeur (ex: "10"). Si la profondeur demandée n'existe pas, on utilise la clé numérique la plus proche.
- Nœud par position du héros (BTN|SB|BB).
- Scénarios :
  - `FirstIn`: map handLabel -> action
  - `VsOpen` / `VsShove`: map villainPos -> (handLabel -> action)
- Labels de mains : paires -> "AA", suited -> "AKS", offsuit -> "AKO" (note : offsuit est marqué "O"), dix = "T" dans les labels (ex: TT).
- Actions autorisées : "fold", "call", "raise", "shove".

Comment reprendre le travail (quick start)
- Installer dépendances : `npm install`.
- Développement rapide (exécuter le CLI en TS) : `npm run dev` puis fournir les flags.
- Build : `npm run build`.
- Lancer le binaire buildé : `npm start` ou `npm run test` (script test courant exécute le CLI pour un cas précis).
- Tests unitaires rapides (TypeScript via ts-node) : `npm run test:unit`.

Fichiers importants
- `src/cli.ts` : point d'entrée CLI.
- `src/domain.ts` : définitions types, parsing/normalisation.
- `src/ranges/RangeRepository.ts` : lecture et recherche des ranges.
- `src/DecisionEngine.ts` : logique de décision et fallback.
- `data/preflop.ranges.json` : données de ranges actuelles (exemples).
- `package.json` : scripts utiles (`build`, `dev`, `test`, `test:unit`).

Assomptions actuelles
- On travaille avec CommonJS (tsconfig module: CommonJS) pour éviter des problèmes d'import/ESM sur Node.
- Villain positions ne sont pas fournies via CLI : l'outil itère automatiquement sur toutes les positions adverses possibles (celles != hero).
- Input main : si suit/format ambigu, on considère offsuit par défaut (comportement conservateur).

Prochaines étapes recommandées (priorisées)
1. Ajouter validation et typage du schéma JSON des ranges (erreurs claires en cas de format invalide).
2. Implémenter une page simple d'UI (web) ou TUI pour affichage plus ergonomique.
3. Élargir la couverture des ranges et documenter la convention des labels (valeurs, suited/offsuit/paires).
4. Ajouter des tests unitaires plus robustes (closestDepthKey, parsing, cas limites) et mettre en place CI (build + tests).
5. Supporter des tailles de profondeur hors de [5..15] si nécessaire et ajouter interpolation si besoin.

Notes pour la reprise future
- Pour retrouver rapidement l'état, lancer :
  - `npm run build` puis `npm start` pour tester le CLI compilé.
  - `npm run test:unit` pour exécuter la batterie de tests locales.
- Les points d'intérêt à vérifier après réinitialisation du contexte :
  - `normalizeHandLabel` (surtout formats rares),
  - `RangeRepository.closestDepthKey` (choix de la profondeur la plus proche),
  - `DecisionEngine.fallback` (valeurs par défaut),
  - `tsconfig.json` (module CommonJS si problème d'imports).

Contact / historique rapide des actions réalisées
- Implémentation initiale CLI, Domain, RangeRepository, DecisionEngine.
- Ajout d'un parser de main robuste et de tests unitaires pour normalisation, repository et moteur de décision.

---

Fin de l'Agent.md — conserve ce fichier en tête de repo; il contient tout le nécessaire pour reprendre le projet même si le contexte de l'IA est réinitialisé.
