# DataShare

> Plateforme de transfert sécurisé de fichiers (MVP) — Projet 4 OpenClassrooms / DataShare

Application web permettant à des utilisateurs (anonymes ou authentifiés) de partager
des fichiers via des liens de téléchargement temporaires.

## Stack technique

| Couche | Technologie |
|---|---|
| Front-end | Angular 18 (TypeScript) |
| Back-end | Spring Boot 3.3 (Java 21) |
| Base de données | PostgreSQL 16 |
| Stockage | Système de fichiers local (interface `StorageService` S3-ready) |
| Authentification | JWT (Spring Security + jjwt) |
| Tests | JUnit 5, Mockito, Testcontainers · Jasmine/Karma · Cypress · k6 |

## Arborescence

```
.
├── backend/                 # API Spring Boot 3
├── frontend/                # SPA Angular 18
├── docs/
│   └── conception/          # Architecture, MCD, OpenAPI (livrables Étape 1)
├── ops/
│   └── docker-compose.dev.yml   # PostgreSQL local pour le dev
├── .editorconfig
├── .gitignore
├── commitlint.config.js
└── README.md
```

## Prérequis

- **Java 21** (`java -version`)
- **Maven 3.9+** (`mvn -v`)
- **Node.js 20+** et **npm 10+** (`node -v`)
- **Docker Desktop** (pour PostgreSQL local)

## Démarrage rapide

### 1) Lancer PostgreSQL en local

```bash
docker compose -f ops/docker-compose.dev.yml up -d
```

PostgreSQL est exposé sur `localhost:5432` (db `datashare`, user `datashare`, mot de passe `datashare`).

### 2) Lancer le back-end

```bash
cd backend
mvn spring-boot:run
```

L'API démarre sur `http://localhost:8080`.
Documentation OpenAPI auto-générée : `http://localhost:8080/swagger-ui.html`.
Endpoint de santé : `http://localhost:8080/api/v1/health`.

### 3) Lancer le front-end

```bash
cd frontend
npm install
npm start
```

L'application est disponible sur `http://localhost:4200`.
Au démarrage, la page d'accueil affiche le résultat du **ping** vers `/api/v1/health`
(prouvant que la chaîne front → proxy → back → BDD est opérationnelle).

## Conventional Commits

Le projet suit la spécification [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat(scope): ajoute la fonctionnalité X
fix(scope): corrige le bug Y
chore: tâche de maintenance
docs: mise à jour de la documentation
test: ajout de tests
refactor: refactorisation
```

Une vérification est en place via [`commitlint`](./commitlint.config.js).

## Documentation

| Document | Lien |
|---|---|
| Stack technique & justification | [`docs/conception/01-stack-technique.md`](./docs/conception/01-stack-technique.md) |
| Architecture logicielle | [`docs/conception/02-architecture.md`](./docs/conception/02-architecture.md) |
| MCD | [`docs/conception/03-mcd.md`](./docs/conception/03-mcd.md) |
| Contrat d'interface OpenAPI | [`docs/conception/04-openapi.yaml`](./docs/conception/04-openapi.yaml) |

## Licence

Code propriétaire — DataShare © 2025.
