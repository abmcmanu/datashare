# DataShare — Back-end

API REST Spring Boot 3 / Java 21.

## Démarrer en local

```bash
# 1) PostgreSQL (depuis la racine du repo)
docker compose -f ../ops/docker-compose.dev.yml up -d

# 2) API
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
```

L'API écoute sur `http://localhost:8080`.

| Endpoint | Description |
|---|---|
| `GET /api/v1/health` | Ping public (utilisé par le front pour le E2E) |
| `GET /swagger-ui.html` | Documentation OpenAPI auto-générée |
| `GET /actuator/health` | Health check Spring |

## Tests

```bash
mvn test
```

Le rapport de couverture JaCoCo est généré dans `target/site/jacoco/index.html`.

## Variables d'environnement

| Nom | Description | Valeur par défaut (dev) |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Profil actif (`dev` / `prod`) | — |
| `DATASHARE_JWT_SECRET` | Secret JWT (32+ caractères) | dev-only |
| `DATASHARE_STORAGE_PATH` | Dossier de stockage des fichiers | `./uploads` |
| `DATASHARE_CORS_ORIGINS` | Origines CORS autorisées (CSV) | `http://localhost:4200` |
| `DATASHARE_DB_URL` (prod) | URL JDBC PostgreSQL | — |
| `DATASHARE_DB_USER` (prod) | Utilisateur BDD | — |
| `DATASHARE_DB_PASSWORD` (prod) | Mot de passe BDD | — |

## Structure des paquets

```
com.datashare
├── DataShareApplication.java   ← point d'entrée
├── config/                      ← Security, OpenAPI, CORS
├── controller/                  ← endpoints REST
├── service/                     ← logique métier
├── repository/                  ← Spring Data JPA
├── domain/                      ← entités JPA
├── dto/                         ← objets de transfert
├── security/                    ← JwtAuthFilter, JwtUtil (à venir)
├── storage/                     ← StorageService (à venir)
├── scheduler/                   ← FilePurgeScheduler (à venir)
└── exception/                   ← @RestControllerAdvice (à venir)
```
