# Expresso Solver — Monorepo

But: garder le projet simple pour le développement local (pas de focus production pour l'instant).

Structure
- frontend/ — UI (Vite + Vue 3)
- backend/ — API + CLI (TypeScript)

Commandes utiles (depuis la racine)

1) Installer les dépendances pour le monorepo :

```cmd
npm install
```

2) Lancer le mode développement (démarre backend + frontend en parallèle) :

```cmd
npm run dev
```

(si vous préférez lancer les serveurs séparément, ouvrez deux terminaux dans la racine :) )

Frontend seul :
```cmd
npm --prefix frontend run dev
```

Backend seul :
```cmd
npm --prefix backend run dev
```

3) Lancer les tests unitaires backend :

```cmd
npm --prefix backend run test:unit
```

Raisonnement
- Projet organisé en workspaces pour séparer les dépendances et scripts par sous-projet.
- `npm run dev` racine utilise `npm-run-all` (installé en devDependencies racine) pour démarrer frontend et backend en parallèle.
- J'ai supprimé/consulté les scripts superflus et déplacé ce qui concernait la prod dans les sous-projets. L'approche privilégie le flux dev rapide.

Si vous voulez encore plus simple : je peux remplacer le script `dev` racine par une note dans le README conseillant d'ouvrir deux terminaux et lancer les commandes `npm --prefix frontend run dev` et `npm --prefix backend run dev` séparément (supprime la dépendance `npm-run-all`). Dites-moi si vous préférez ça.

