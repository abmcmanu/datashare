# Garanti de Sécurité (DataShare)

Ce document résume les analyses de sécurité et les décisions architecturales prises pour protéger les données de l'application DataShare.

## 1. Scan de Sécurité Basique

Des analyses de vulnérabilités sont exécutées régulièrement sur les dépendances du projet (SCA - Software Composition Analysis).

### Frontend (Node.js / Angular)
Commande utilisée : `npm audit`
- **Résultat** : 0 vulnérabilité critique. Les bibliothèques tierces sont maintenues à jour.

### Backend (Java / Spring Boot)
Commande utilisée : `mvn dependency-check:check -Danalyzer.ossindex.enabled=false`
- **Résultat** : Aucune dépendance obsolète contenant une CVE (Common Vulnerabilities and Exposures) majeure n'a été détectée. La version de Spring Boot utilisée (3.x) intègre les derniers correctifs de sécurité.
> il faut au préalable obtenir une clé d'API https://nvd.nist.gov/developers/request-an-api-key 

## 2. Analyse Succincte des Résultats du Scan

Les outils de scan confirment que l'empreinte logicielle est saine. Les rares alertes de niveau "Low" (faible) identifiées dans les rapports (ex: dépendances transitives de développement) ne sont pas déployées en production et n'exposent donc pas l'application aux attaques.

## 3. Analyse Succincte des Décisions de Sécurité

Plusieurs décisions architecturales "Secure by Design" ont été prises :

- **Authentification Stateless (JWT)** : L'application n'utilise pas de sessions côté serveur. Les tokens JWT sont signés (HMAC) avec un secret fort, possèdent une courte durée de vie, et protègent contre les attaques CSRF.
- **Stockage des Mots de Passe** : Les mots de passe utilisateurs (ainsi que les mots de passe optionnels des fichiers) ne sont jamais stockés en clair. Ils sont hachés avec **BCrypt (cost 12 pour les users, 10 pour les fichiers)** avec un sel unique par entrée.
- **Génération de Liens Publics** : Les identifiants de fichiers (`/d/{token}`) utilisent des tokens cryptographiquement sûrs (`SecureRandom` + Base64URL de 32 octets) et non prédictibles (pas de compteurs ni d'ID incrémentaux exposés).
- **Contrôle d'Accès (CORS)** : L'API Spring Boot restreint strictement les origines autorisées (définies via `application.yml` avec la propriété `datashare.cors.allowed-origins`).
- **Limitation d'Upload** : Les fichiers téléversés sont limités en taille (1 Go max validé backend) et les extensions dangereuses (`.exe`, `.sh`, `.bat`) sont bloquées pour prévenir l'hébergement de malwares.
- **Droit d'Accès Logique** : Une vérification stricte du propriétaire (Ownership) est effectuée sur toutes les requêtes protégées (ex: `DELETE /api/v1/files/{id}`). Un utilisateur ne peut interagir qu'avec ses propres entités.
