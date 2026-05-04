# Plan de Tests (DataShare)

Ce document détaille la stratégie de test mise en place pour garantir la qualité et la fiabilité de l'application DataShare.

## 1. Tests Unitaires (Features MVP)

Les tests unitaires couvrent de manière isolée les services et composants métier critiques.

### Backend (Spring Boot / JUnit 5 / Mockito)
- **`FileServiceTest`** : Vérification de la logique métier (Upload, génération de tokens uniques, validation de taille/extension, purge automatique US10, suppression US06, et droits d'accès).
- **`AuthServiceTest`** : Vérification du hachage de mot de passe (BCrypt) et de la génération JWT.
- **`FileControllerTest`** : Vérification des codes HTTP de retour (200, 401, 403, 404) via `@WebMvcTest`.

### Frontend (Angular / Jasmine / Karma)
- **`FileService.spec.ts`** : Vérification du calcul de formatage de taille (`formatSize`), parsing d'extensions, et requêtes HTTP mockées.
- **`DashboardComponent.spec.ts`** : Vérification de l'état (loading, error), des filtres (Actifs, Expirés), et de l'affichage de la modale de suppression.

## 2. Tests End-to-End (E2E)

Les tests E2E simulent le parcours d'un utilisateur réel. Ils sont réalisés avec **Cypress**.

### Scénarios Critiques (MVP)
1. **Upload Anonyme (US07)** :
   - *Scénario* : L'utilisateur arrive sur la page d'accueil, clique sur "Ajouter", upload un fichier valide, et obtient un lien de téléchargement.
   - *Vérification* : Le lien `/d/:token` est généré et affiche les métadonnées.
2. **Authentification (US03/US04)** :
   - *Scénario* : L'utilisateur remplit le formulaire de connexion avec des identifiants valides.
   - *Vérification* : Redirection vers `/dashboard` et token JWT stocké en `localStorage`.
3. **Suppression de Fichier (US06)** :
   - *Scénario* : Un utilisateur connecté voit son fichier sur le dashboard, clique sur "Supprimer", et confirme dans la modale.
   - *Vérification* : Le fichier disparaît de la liste et n'est plus accessible via son lien public.

## 3. Critères d'Acceptation pour les Tests

- **Fiabilité** : 100% des tests unitaires et E2E doivent passer avec succès sur la CI (GitHub Actions / GitLab CI) avant toute fusion de PR (Pull Request).
- **Indépendance** : Aucun test ne doit dépendre de l'état laissé par un autre test. La BDD de test (H2) est recréée à chaque exécution.
- **Temps d'exécution** : La suite de tests unitaires (Back+Front) doit s'exécuter en moins de 3 minutes.

## 4. Instructions d'Exécution

### Backend — tests + rapport JaCoCo

```bash
cd backend
# Lance les tests, génère le rapport ET vérifie le seuil de 70%
mvn clean verify
```

Le rapport HTML s'ouvre dans :
```
backend/target/site/jacoco/index.html
```

> Si la couverture passe sous 70 % (lignes ou branches), le build échoue avec `BUILD FAILURE` et indique les classes concernées.

---

### Frontend — tests + rapport Karma/Istanbul

```bash
cd frontend
npm run test -- --watch=false --code-coverage
```

Le rapport HTML s'ouvre dans :
```
frontend/coverage/datashare/index.html
```
> Si la couverture passe sous 70 %, Karma affiche une erreur `ERROR [coverage-istanbul-reporter]` et retourne un code de sortie non nul.

![Rapport de couverture frontend](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/coverage_frontend.png)
> *rapport de la couverture actuelle.*
---

### E2E (Cypress)

Le frontend (`ng serve`) doit tourner avant de lancer Cypress.

```bash
cd frontend
npm run e2e          # mode headless (CI)
npx cypress open     # interface graphique
```

![cypress](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/cypress.png)
> *capture d'écran cypress e2e*
## 5. Seuil de Couverture Minimal

La couverture minimale est fixée à **70 %** (lignes et branches) pour le backend et le frontend. Ce seuil est **bloquant** : le build échoue s'il n'est pas atteint.

| Stack | Outil | Rapport |
|---|---|---|
| Backend | JaCoCo (Maven) | `target/site/jacoco/index.html` |
| Frontend | Istanbul via Karma | `coverage/datashare/index.html` |

*(Capture d'écran indicative du rapport JaCoCo)*

![Rapport de couverture JaCoCo](https://raw.githubusercontent.com/abmcmanu/datashare/main/public/coverage_backend.png)

> Générer le rapport puis ouvrir `target/site/jacoco/index.html` dans un navigateur pour visualiser la couverture ligne par ligne.
