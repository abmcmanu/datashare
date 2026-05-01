# DataShare — Stack technique retenu

> Document de conception — Étape 1 / livrable préalable
> Référent technique : Manu — Avril 2026

## 1. Synthèse

| Brique | Technologie retenue | Alternatives évaluées |
|---|---|---|
| Back-end | **Spring Boot 3.x (Java 21)** | NestJS, .NET Core, Symfony/Laravel |
| Front-end | **Angular 17+ (TypeScript)** | React, Vue.js |
| Base de données | **PostgreSQL 16** | MongoDB |
| Stockage des fichiers | **Système de fichiers local** (avec abstraction `StorageService`) | AWS S3 |
| Authentification | **JWT** (Spring Security + jjwt) | Sessions, OAuth2 |
| ORM / Persistance | **Spring Data JPA + Hibernate** | JDBC pur, MyBatis |
| Migrations BDD | **Flyway** | Liquibase, scripts SQL manuels |
| Tests back | **JUnit 5 + Mockito + Testcontainers** | Spock, Rest-Assured |
| Tests front | **Jasmine + Karma** (unit) / **Cypress** (E2E) | Jest, Playwright |
| Tests de charge | **k6** | JMeter, Gatling |
| Qualité code | **SonarQube / SonarLint, Checkstyle, ESLint** | — |
| CI/CD | **GitHub Actions** | GitLab CI, Jenkins |
| Tâches planifiées | **Spring Scheduler (`@Scheduled`)** | Quartz, cron OS |

## 2. Justification des choix

### Back-end : Spring Boot

Le périmètre fonctionnel impose une API REST sécurisée avec authentification JWT, des téléversements de fichiers volumineux (jusqu'à 1 Go), une tâche planifiée de purge, une gestion fine des accès. Spring Boot apporte tout cela nativement et de manière éprouvée :

- **Spring Security** est la référence industrielle pour l'authentification JWT et la sécurité des endpoints (CSRF, CORS, rate-limiting via filtres).
- **Spring Data JPA** fournit un mapping objet-relationnel mature, idéal pour le modèle relationnel que les User Stories décrivent (utilisateur ↔ fichiers ↔ tags).
- **Spring Scheduler** couvre US10 (purge quotidienne des fichiers expirés) sans dépendance externe.
- L'écosystème Java offre les outils de qualité les plus matures (SonarQube, JaCoCo, Checkstyle), ce qui est cohérent avec l'attendu « TESTING.md / SECURITY.md / PERF.md / MAINTENANCE.md ».

### Front-end : Angular

- **TypeScript natif et opinionated** : structure imposée (modules, services, guards, interceptors) qui réduit la dette technique sur un projet à 4 semaines.
- **HttpClient + Interceptors** : permet de centraliser proprement l'injection du JWT et la gestion des erreurs HTTP.
- **Reactive Forms** : adapté aux validations strictes demandées dans les User Stories (email, mot de passe, taille, tags).
- **Angular Material / CDK** : couvre l'accessibilité (PSH) attendue dans les bonnes pratiques.
- Le `.gitignore` cible déjà `frontend/.angular/`.

### Base de données : PostgreSQL

- Modèle relationnel **fortement adapté** : entités clairement reliées (User → File → Tag, FileTag pivot, DownloadLog).
- Contraintes d'intégrité référentielle nécessaires (FK `file.owner_id`, ON DELETE CASCADE pour la suppression).
- Transactions ACID indispensables pour garantir l'atomicité (création de fichier + métadonnées + tags).
- Outils éprouvés : `pg_dump` pour les backups (cf. MAINTENANCE.md), index B-tree pour la recherche par token.

> MongoDB aurait été pertinent si nous stockions des documents arbitraires, ce qui n'est pas le cas ici.

### Stockage : système de fichiers local

- **Suffisant pour le MVP** (démo investisseurs) : pas de coût AWS, pas de configuration IAM, pas de latence réseau.
- **Abstraction `StorageService`** dans le code : interface `StorageService` avec deux implémentations (`LocalFileSystemStorage` aujourd'hui, `S3Storage` demain). Le passage à S3 sera une PR isolée.
- Les fichiers sont stockés hors du dossier servi par le serveur web, accédés uniquement via un endpoint authentifié qui contrôle l'expiration et le mot de passe.

### Authentification : JWT

- Imposée par les spécifications (US03/US04).
- **Stateless** : pas de session serveur à gérer, scalable horizontalement.
- **Algorithme HS256** signé avec un secret rotatif stocké en variable d'environnement (jamais en BDD ni en code).
- Durée de vie courte (15 min access token) + refresh token possible en évolution.

### Migrations : Flyway

- Versionnage SQL dans le repo (`backend/src/main/resources/db/migration/V1__init.sql`).
- Réplique le schéma à l'identique en dev / staging / prod.
- Couvre l'attendu « scripts de déploiement BDD » du brief.

## 3. Cohérence avec les exigences du brief

| Exigence | Couverture par le stack |
|---|---|
| Authentification sécurisée (JWT) | Spring Security + jjwt |
| Téléversement jusqu'à 1 Go | Spring `MultipartFile` + streaming |
| Lien public unique non prédictible | UUID v4 + token `SecureRandom` (32 octets) |
| Purge automatique quotidienne | `@Scheduled(cron="0 0 3 * * *")` |
| Hashage mot de passe (compte + fichier) | BCrypt 12 rounds |
| Tests unitaires & E2E avec couverture > 70 % | JUnit + JaCoCo + Cypress |
| Documentation OpenAPI | `springdoc-openapi` (génération auto) |
| Conventional commits + Git history propre | Hook `commitlint` |
| Accessibilité PSH | Angular CDK a11y + audit Lighthouse |

## 4. Risques techniques identifiés

| Risque | Mitigation |
|---|---|
| Téléversement 1 Go bloquant le serveur | Streaming `InputStream` + buffer 8 KB, timeout configuré côté Tomcat |
| Espace disque saturé | Quota par utilisateur (évolution post-MVP), monitoring `df -h` documenté dans MAINTENANCE.md |
| Token de téléchargement deviné | 256 bits d'entropie via `SecureRandom` |
| Brute-force mot de passe fichier | Rate-limiting (`bucket4j`) sur `/api/files/{token}/download` |
| Faille XSS via nom de fichier | Sanitization côté front (`DomSanitizer`) + Content-Disposition côté back |
