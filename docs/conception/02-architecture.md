# DataShare — Architecture logicielle

> Document de conception — Étape 1
> Référent technique : Manu — Avril 2026

## 1. Vue d'ensemble (architecture en couches)

DataShare suit une **architecture 3-tier classique** avec séparation stricte front-end / back-end / persistance, complétée d'un **stockage de fichiers** et d'un **scheduler** pour la purge automatique.
![Schéma de l'application datashare](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/archi-overview.png)
> *Figure 1 : Aperçu de l'architecture cible.*

## 2. Description des briques techniques

### 2.1 Front-end — Angular 17 SPA

| Élément | Rôle |
|---|---|
| `AuthService` | Stockage JWT en mémoire (+ refresh), exposition de l'utilisateur courant. |
| `JwtInterceptor` | Ajoute automatiquement `Authorization: Bearer <token>` sur les requêtes `/api`. |
| `AuthGuard` | Bloque l'accès aux routes `/mes-fichiers` aux utilisateurs non authentifiés. |
| `FileService` | Encapsule les appels REST (upload streaming, list, delete, download). |
| `ErrorInterceptor` | Centralise les 401 (déconnexion auto), 403, 404, 5xx (toast d'erreur). |
| Pages | `/` (upload), `/login`, `/signup`, `/mes-fichiers`, `/d/:token` (download public). |

L'application est buildée (`ng build --configuration production`) puis servie en fichiers statiques par Nginx.

### 2.2 Reverse proxy — Nginx

- **Terminaison TLS** (Let's Encrypt) — l'API ne voit que de l'HTTP en interne.
- **Routage** : `/` → SPA Angular, `/api/**` → conteneur Spring Boot.
- **Limites** : `client_max_body_size 1024m;` pour autoriser l'upload 1 Go.
- **Headers de sécurité** : `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`.
- **Rate-limit** sur `/api/auth/**` (10 req/min/IP) et `/api/files/*/download` (60 req/min/IP).

### 2.3 Back-end — Spring Boot 3

Architecture en couches dans le dossier `backend/src/main/java/com/datashare/` :

```
controller/   ← endpoints REST, validation @Valid, mapping DTO
service/      ← logique métier (upload, expiration, ownership)
repository/   ← Spring Data JPA (interfaces)
domain/       ← entités JPA (User, File, Tag, FileTag)
security/     ← JwtAuthFilter, JwtUtil, SecurityConfig, BCrypt
storage/      ← StorageService (interface) + LocalFileSystemStorage
scheduler/    ← FilePurgeScheduler
config/       ← OpenAPI, CORS, Multipart, ObjectMapper
exception/    ← @RestControllerAdvice, ApiError
```

#### 2.3.1 Sécurité

| Couche | Mécanisme |
|---|---|
| Authentification | JWT HS256, secret en variable d'env, durée 15 min |
| Mot de passe utilisateur | BCrypt 12 rounds |
| Mot de passe fichier | BCrypt 10 rounds (hash distinct, jamais le même qu'utilisateur) |
| Token de téléchargement | 32 octets `SecureRandom` → Base64URL (43 caractères) |
| CORS | Origine front en liste blanche |
| Validation entrées | `@Valid` + `@NotBlank`, `@Email`, `@Size`, `@Max(1GB)` |
| En-têtes HTTP | `Content-Disposition: attachment; filename*=...` (RFC 5987) |

#### 2.3.2 Streaming d'upload / download

- `MultipartFile` configuré en streaming (`spring.servlet.multipart.file-size-threshold=10MB`) pour ne pas charger 1 Go en mémoire.
- Download : `StreamingResponseBody` qui pipe le `InputStream` du `StorageService` vers la réponse HTTP.

#### 2.3.3 Scheduler

```java
@Scheduled(cron = "0 0 3 * * *", zone = "Europe/Paris")
public void purgeExpiredFiles() { ... }
```
- Sélectionne `WHERE expires_at < NOW()`.
- Supprime le binaire via `StorageService`, puis la ligne en BDD (cascade vers `file_tags`).
- Logge un compteur dans Micrometer (exposé via `/actuator/prometheus`).

### 2.4 Persistance — PostgreSQL 16

- Base `datashare`, schéma unique `public`.
- Pool de connexions HikariCP (10 par défaut).
- Migrations Flyway (`V1__init.sql`, `V2__add_index_token.sql`, ...).
- Backups : `pg_dump` quotidien (script `ops/backup.sh`, documenté dans MAINTENANCE.md).

### 2.5 Stockage des fichiers — système de fichiers local

- Dossier `/var/datashare/uploads/` (chmod 0700, propriétaire `datashare`).
- Nom physique = UUID v4 (jamais le nom utilisateur, pour éviter path traversal).
- Métadonnées (`original_filename`, `mime_type`, `size_bytes`) stockées en BDD.
- L'interface `StorageService` permet de basculer vers S3 sans toucher au reste du code.

## 3. Flux applicatifs critiques

### 3.1 Upload authentifié (US01)
![Upload authentifié (US01)](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/US01.png)
> *Figure 2 : Upload authentifié (US01).*


### 3.2 Téléchargement via lien (US02)

![Téléchargement via le lien (US02)](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/US02.png)
> *Figure 3 : Téléchargement via le lien (US02).*


### 3.3 Purge automatique (US10)

![Purge automatique (US10)](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/US10.png)
> *Figure 4 : Purge automatique (US10).*

## 4. Points d'attention transverses

| Sujet | Décision |
|---|---|
| Observabilité | Spring Boot Actuator + Micrometer → Prometheus |
| Logs | Format JSON (`logback-spring.xml`), niveau INFO en prod, DEBUG en dev |
| Configuration | `application-{profile}.yml` (`dev`, `prod`), secrets en env |
| CORS | Liste blanche exclusivement front |
| Healthcheck | `/actuator/health` exposé à Nginx pour load-balancer ready |
| RGPD | Suppression cascadée à expiration ou demande utilisateur, logs sans données perso |
