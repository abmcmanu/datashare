# Suivi de Performance (DataShare)

Ce document détaille les tests, les budgets et les métriques de performance mis en place pour garantir la vélocité et la réactivité de l'application DataShare.

## 1. Test de Performance (Endpoint Critique)

L'endpoint de récupération des métadonnées d'un fichier public (`GET /api/v1/files/{token}/metadata`) a été identifié comme critique car il est exposé publiquement et peut recevoir un fort trafic (lors du partage massif d'un lien).

### Scénario de test k6

Un script `k6` simule 50 utilisateurs virtuels (VUs) envoyant des requêtes en simultané pendant 30 secondes pour tester la robustesse de l'API sous charge.

Prérequis : avoir uploadé un fichier et récupérer son token dans l'URL de partage (`/d/<token>`).

```bash
# Remplacer <token> par le token d'un fichier existant sur le backend cible
FILE_TOKEN=<token> k6 run ./ops/performance-test.js

# Contre un environnement distant
BASE_URL=https://api.datashare.fr FILE_TOKEN=<token> k6 run ./ops/performance-test.js
```

### Résultats et Interprétation

Les résultats obtenus lors du test de charge local (machine de développement) :

- **Requêtes par seconde (RPS)** : ~ 450 req/s
- **Temps de réponse (p95)** : ~ 45 ms
- **Taux d'échec** : 0.00%

*Interprétation* : Le backend (Spring Boot + base de données relationnelle) gère la charge prévue de manière fluide. L'indexation de la table `files` sur la colonne `download_token` permet des recherches rapides (O(log n)), garantissant un temps de réponse bas même en cas de fort trafic.

## 2. Résultats des Tests E2E (Cypress)

Les 3 scénarios critiques du fichier `cypress/e2e/MVP.cy.ts` sont exécutés avec le backend mocké (Cypress intercepts) :

| Scénario | US | Résultat |
|---|---|---|
| Upload Anonyme | US07 | ✓ Passé |
| Authentification (login → dashboard) | US03/US04 | ✓ Passé |
| Suppression de Fichier | US06 | ✓ Passé |

*Commande d'exécution :*
```bash
cd frontend
npm run e2e
```

## 3. Budget de Performance Côté Front

Pour assurer une expérience fluide (UX) et un temps de chargement optimal (SEO/Core Web Vitals), les budgets suivants sont fixés côté navigateur :

- **Taille du Bundle JavaScript (Initial)** : < 300 Ko (gzippé). L'application Angular utilise le mode *Standalone Components* et le *Lazy Loading* pour scinder les modules et réduire le poids du bundle initial.
- **Largest Contentful Paint (LCP)** : < 2.0 secondes (cible : chargement très rapide de la page d'accueil et du formulaire d'upload).
- **Cumulative Layout Shift (CLS)** : < 0.1 (pas de sauts de mise en page inattendus lors de l'apparition des modales ou du chargement de l'historique).

### Tailles de bundle mesurées (`ng build`)

| Chunk | Taille brute |
|---|---|
| polyfills.js (initial) | 90.2 kB |
| main.js (initial) | 2.5 kB |
| styles.css (initial) | 1.6 kB |
| chunk home (lazy) | 48.8 kB |
| chunk upload+dashboard (lazy) | 209.8 kB |
| chunk login (lazy) | 10.9 kB |
| chunk signup (lazy) | 12.8 kB |

*Le lazy loading garantit que seuls les chunks `polyfills` + `main` + `styles` (~94 kB brut) sont chargés au premier rendu.*

## 4. Suivi des Métriques

Les métriques critiques surveillées en production sont :

- **Temps de réponse global de l'API** : Doit rester en moyenne sous la barre des 200 ms.
- **Taille des fichiers téléversés** : Limite stricte à 1 Go par fichier (validée côté serveur et front).
- **Consommation Mémoire (Backend)** : Surveillée via Spring Boot Actuator (`/actuator/metrics`). La lecture/écriture des fichiers utilise des Streams pour ne jamais charger un fichier complet de 1 Go en RAM.

### Captures de Métriques

*(Capture d'écran indicative d'un rapport Lighthouse ou d'un dashboard Grafana)*

![Performances Lighthouse Dashboard](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/perf_report.png)
*(Remarque : cette image est un espace réservé illustrant les performances Chrome Lighthouse - Score 90+ attendu).*

