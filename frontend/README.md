# DataShare — Front-end

SPA Angular 18 (TypeScript, standalone components, signals).

## Démarrer en local

```bash
npm install
npm start         # ng serve --proxy-config proxy.conf.json
```

Ouvrir `http://localhost:4200`.

Le proxy `/api` est redirigé vers `http://localhost:8080` (le back-end Spring Boot).
La page d'accueil affiche le résultat du **ping E2E** vers `/api/v1/health` —
si tu vois `✓ UP — datashare-backend v0.1.0`, la chaîne fonctionne.

## Scripts npm

| Script | Description |
|---|---|
| `npm start` | Dev server avec proxy vers le back |
| `npm run build` | Build production (vérifie aussi les budgets) |
| `npm test` | Karma + Jasmine (couverture activée) |
| `npm run lint` | Linter |

## Structure

```
src/
├── app/
│   ├── app.component.ts      ← root <ds-root>
│   ├── app.routes.ts          ← routing minimal
│   ├── core/
│   │   └── services/
│   │       └── api.service.ts ← appels REST vers le back
│   └── features/
│       └── home/
│           └── home.component.* ← page d'accueil + ping E2E
├── environments/
│   ├── environment.ts        ← dev (apiBaseUrl = /api/v1)
│   └── environment.prod.ts
├── index.html
├── main.ts
└── styles.scss
```

## Budgets de performance

Définis dans `angular.json` :
- bundle initial : warning 500 kB / erreur 1 MB
- styles par composant : warning 4 kB / erreur 8 kB

Ces seuils sont rappelés dans `PERF.md` (à venir).
