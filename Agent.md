# Agent.md

Résumé \- objectif
- Outil CLI pour recommander des décisions préflop en heads\-up \(`2`\) ou 3\-max \(`3`\) selon la profondeur \(\~bb\), la position \(`BTN|SB|BB`\), le scénario \(`FirstIn|VsOpen|VsShove`\) et la main du héros. Les décisions sont lues depuis un fichier de ranges JSON, avec sélection de la profondeur la plus proche.

Contexte et portée
- Cible: formats Expresso/Spin & Go courts tapis.
- Portée: préflop uniquement, 2 ou 3 joueurs, scénarios définis.
- Hors portée: postflop, ICM avancé, parsing de mains complexes, import de HH.

Fonctionnement à haut niveau
- Le CLI parse les options, normalise la main, charge `data/preflop.ranges.json`, récupère l’action \(`fold|call|raise|shove`\) via `RangeRepository.find(...)`, applique un repli conservateur si absence de range, puis affiche les résultats pour `FirstIn` et pour chaque vilain en `VsOpen` et `VsShove`.

Entrées / sorties
- Entrées CLI: `--players <2|3> --depth <5..15> --position <BTN|SB|BB> --hand <ex: AKs>`.
- Sortie: lignes `[Scenario [vs Position]] HAND -> ACTION`.
- Normalisation mains: majuscules sans espaces \(`AKs` -> `AKS`, `A2o` -> `A2O`\).

Données \- schéma attendu `data/preflop.ranges.json`
- Racine par nombre de joueurs: clés `"2"`, `"3"`.
- Niveaux de profondeur: clés numériques en chaîne \(`"5"`, `"10"`, ...\). Si profondeur exacte absente, sélection de la plus proche.
- Nœud de position du héros: `BTN|SB|BB` selon `players`.
- Scénarios:
    - `FirstIn` -> `handLabel` -> `action`.
    - `VsOpen`/`VsShove` -> `villainPos` -> `handLabel` -> `action`.
- `handLabel`: valeurs normalisées \(`AA`, `AKS`, `A2O`, etc.\).
- `action`: une de `fold|call|raise|shove`.

Règles de décision implémentées
- Positions autorisées: `2` -> `SB,BB`; `3` -> `BTN,SB,BB`.
- Profondeur clampée \[5..15\] côté CLI, choix de la profondeur la plus proche dans les données.
- Fallback si absence de range:
    - `FirstIn`: `fold`
    - `VsOpen`: `fold`
    - `VsShove`: `call`

Architecture \- fichiers clés
- `src/cli.ts`: interface CLI, collecte des décisions pour `FirstIn`, `VsOpen`, `VsShove`, affichage.
- `src/domain.ts`: types \(`PlayersCount`, `Position`, `Scenario`\), parsing/validation, utilitaires \(`normalizeHandLabel`\).
- `src/ranges/RangeRepository.ts`: chargement JSON, résolution d’action via arbre \+ profondeur la plus proche.
- `src/DecisionEngine.ts`: normalisation de la main, interrogation du repo, logique de repli.
- `package.json`: `bin` -> `dist/cli.js`, scripts `build/start/dev/test`.
- `.gitignore`: Node/TS, IDE \(`.idea`\), caches, logs.

Utilisation
- Installer deps: `npm i`
- Dev: `npm run dev`
- Build: `npm run build`
- Lancer: `npm start`
- Test rapide: `npm run test`
- Global \(Windows\): `npm link`, puis `preflop --players 3 --depth 10 --position BTN --hand AKs`

Qualité \- limitations actuelles
- Pas de validation robuste du schéma JSON.
- Couverture de ranges minimale d’exemple.
- Pas encore de tests unitaires.

Feuille de route \- prochaines étapes
- Valider/typer le schéma des ranges et reporter des erreurs claires.
- Étendre les ranges et documenter la convention des labels \(`s/o/paires`\).
- Tests unitaires: `closestDepthKey`, `find`, parsing \& scénarios.
- Améliorer les messages d’erreur et les codes de sortie.
- CI basique \(`build` \+ tests\).

Références rapides
- Repo: `origin https://github.com/rdieulan/expresso-solver.git`
- Projet: `preflop-cli` \(Node/TypeScript, `yargs`\)
- Environnement: Windows, PhpStorm 2024\.1\.7
