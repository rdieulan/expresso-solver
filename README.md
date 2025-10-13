expresso-solver — Assistant de décision préflop (Expresso Nitro)

But
----
Outil CLI pour recommander des décisions PRÉFLOP (FirstIn, VsOpen, VsShove) en formats Expresso Nitro (2-max / 3-max).

Ressources clés
---------------
- Code: `src/` (TypeScript)
- Ranges example: `data/preflop.ranges.json`
- CLI binaire (build): `dist/cli.js`
- Fichier de configuration TS: `tsconfig.json`
- Documentation d'agent/état: `Agent.md`

Usage rapide
-----------
(Windows `cmd.exe`)

- Installer les dépendances :

```bash
npm install
```

- Exécuter en développement (ts-node) :

```bash
npm run dev -- --players 3 --depth 10 --position BTN --hand AKs
```

- Construire :

```bash
npm run build
```

- Lancer le binaire compilé (exemple) :

```bash
npm run test
```

- Sortie JSON lisible par machine :

```bash
node dist/cli.js --players 3 --depth 10 --position BTN --hand AKs --format json
```

Scripts utiles
--------------
- `npm run build` : compile TypeScript
- `npm run start` : exécute `dist/cli.js`
- `npm run test` : lance un exemple de CLI compilé
- `npm run dev` : exécute le CLI en TS via `ts-node`
- `npm run test:unit` : exécute les tests unitaires locaux (normalize, ranges, decision)

Structure des données
---------------------
Fichier `data/preflop.ranges.json` :
- Racine par nombre de joueurs: keys "2", "3".
- Sous chaque nombre: clés de profondeur (`"10"`), puis position du héros (`BTN|SB|BB`).
- Scénarios:
  - `FirstIn`: map `handLabel -> action`
  - `VsOpen` / `VsShove`: map `villainPos -> (handLabel -> action)`
- Labels de mains: `AA`, `AKS`, `AKO`, `A2O`, etc.
- Actions: `fold|call|raise|shove`.

Tests
-----
- `npm run test:unit` exécute trois petits tests via `ts-node`:
  - `src/tests/normalize.test.ts` : normalisation des labels de mains
  - `src/tests/range.test.ts` : lecture et recherche de ranges
  - `src/tests/decision.test.ts` : intégration `DecisionEngine`

Notes pour développeur
---------------------
- Le module TS est compilé en CommonJS (tsconfig.json) pour éviter des problèmes d'import ESM sur Node.
- Les entrées de main acceptées sont tolérantes (ex: `AhKs`, `AKs`, `AK`, `a k s`), converties en labels normalisés.
- `Agent.md` contient les informations nécessaires pour reprendre le travail si le contexte est réinitialisé.

Prochaines améliorations suggérées
---------------------------------
- Validation / typing plus stricte du schéma JSON (actuellement une validation légère est appliquée).
- Ajouter plus de ranges et une documentation formelle des conventions de labels.
- Ajouter une UI minimale (TUI / Web) et un pipeline CI pour build+tests.

Licence
-------
Projet privé pour usage personnel (modifier selon besoin).

