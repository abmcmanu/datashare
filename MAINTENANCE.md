# Documentation de Maintenance (DataShare)

Ce document décrit les procédures, la fréquence et les stratégies de gestion des risques liées à la mise à jour des dépendances du projet DataShare.

## 1. Procédures de Mise à Jour des Dépendances

Afin de garantir la sécurité et l'évolutivité de l'application, les dépendances frontend (Angular/npm) et backend (Spring Boot/Maven) doivent être maintenues à jour régulièrement. L'utilisation d'outils automatisés est recommandée.

### Outils Automatisés
- **Dependabot / Renovate** : Configuration à la racine du dépôt (via `.github/dependabot.yml` par exemple) pour scanner automatiquement les fichiers `package.json` et `pom.xml`.
- **Création Automatique de PR** : Dès qu'une mise à jour est disponible, l'outil ouvre automatiquement une Pull Request.
- **Vérification CI** : La suite de tests unitaires et E2E se lance automatiquement sur ces PR pour valider qu'aucune régression n'est introduite.

## 2. Fréquence de Mise à Jour

La maintenance est divisée en deux cadences selon la criticité :

- **Mises à jour mineures et correctifs (Patch / Minor)** : **Hebdomadaire** (ex: tous les lundis matins). Concerne les correctifs de bugs et les patchs de sécurité (ex: Angular 17.1.0 -> 17.1.1, Spring Boot 3.2.1 -> 3.2.2).
- **Mises à jour majeures (Major)** : **Mensuelle ou Trimestrielle** selon les cycles de publication officiels (ex: Angular 17 -> 18, migration de version majeure de librairie). Nécessite une revue de code humaine et des tests manuels supplémentaires.

## 3. Gestion des Risques

Mettre à jour des dépendances comporte des risques inhérents. Voici comment DataShare les gère :

### Risques Identifiés
- **Breaking Changes (Changements bloquants)** : Une nouvelle version majeure modifie l'API d'une librairie, provoquant des erreurs de compilation ou d'exécution.
- **Incompatibilités de Plugins** : Des plugins ou dépendances transitives entrent en conflit (ex: version de TypeScript non supportée par une nouvelle version d'Angular).
- **Régression Fonctionnelle Silencieuse** : Un bug introduit dans une dépendance tierce affecte une fonctionnalité (ex: faille dans le parsing des uploads).

### Stratégie de Mitigation
- Les mises à jour majeures ne sont **jamais fusionnées automatiquement**. Elles nécessitent l'approbation d'un développeur après lecture du `CHANGELOG`.
- Le seuil de **70% minimum de couverture de test** (cf. `TESTING.md`) assure qu'un changement bloquant dans les dépendances métier fera échouer la CI.
- L'approche "Zero Dependency" sur l'interface (pas de librairies lourdes comme Bootstrap ou Tailwind, juste du SCSS pur et Angular) réduit drastiquement la surface d'exposition aux conflits frontend.
- Le backend s'appuie strictement sur l'écosystème Spring (Spring Boot, Spring Security, Spring Data JPA) qui assure une très forte cohérence interne entre ses modules, limitant les conflits de versions ("Dependency Hell").
