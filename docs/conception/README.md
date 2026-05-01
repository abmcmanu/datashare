# DataShare — Étape 1 : Conception

> Référent technique : Manu — Avril 2026

Ce dossier regroupe les livrables de **l'étape 1 — Conception** du projet DataShare.

## Livrables

| # | Livrable | Fichier | Format                             |
|---|---|---|------------------------------------|
| 1 | Stack technique & justification | [`01-stack-technique.md`](./01-stack-technique.md) | Markdown                           |
| 2 | Architecture logicielle (schéma + description) | [`02-architecture.md`](./02-architecture.md) | Markdown + excalidraw              |
| 3 | MCD (Modèle Conceptuel de Données) | [`03-mcd.md`](./03-mcd.md) | Dbeaver + ERD diagram + SQL DDL + excalidraw |
| 4 | Contrat d'interface | [`04-openapi.yaml`](./04-openapi.yaml) | OpenAPI 3.0.3                      |

## Stack retenu (résumé)

- **Back-end** : Spring Boot 3 (Java 21)
- **Front-end** : Angular 17 (TypeScript)
- **Base de données** : PostgreSQL 16
- **Stockage fichiers** : système de fichiers local (interface abstraite, S3-ready)
- **Authentification** : JWT (HS256), BCrypt 12 rounds

## Comment visualiser les diagrammes

Le contrat OpenAPI peut être visualisé avec :
- <https://editor.swagger.io> (copier/coller le YAML),
- VS Code + extension *Swagger Viewer*,
- en local : `npx @redocly/cli preview-docs 04-openapi.yaml`.

## Couverture des User Stories

| US | Couverture | Routes | Entités impactées |
|---|---|---|---|
| US01 — Upload connecté | ✅ | `POST /files` | USER, FILE, TAG |
| US02 — Téléchargement via lien | ✅ | `GET /files/{token}/metadata`, `POST /files/{token}/download` | FILE, DOWNLOAD_LOG |
| US03 — Création de compte | ✅ | `POST /auth/signup` | USER |
| US04 — Connexion | ✅ | `POST /auth/login` | USER |
| US05 — Historique | ✅ | `GET /me/files` | USER, FILE |
| US06 — Suppression | ✅ | `DELETE /me/files/{id}` | FILE |
| US07 — Upload anonyme (option) | 🟡 modélisé | `POST /files` (sans JWT) | FILE (`owner_id` nullable) |
| US08 — Tags (option) | 🟡 modélisé | `/me/tags`, `tagIds` à l'upload | TAG, FILE_TAG |
| US09 — Mot de passe fichier (option) | 🟡 modélisé | `password` dans upload + download | FILE.password_hash |
| US10 — Expiration auto (option) | 🟡 modélisé | Scheduler back, `expiresAt` exposé | FILE.expires_at |

> 🟡 = pas obligatoire pour le MVP, mais le MCD et l'API les supportent dès le départ pour ne pas avoir à casser le contrat ensuite.
