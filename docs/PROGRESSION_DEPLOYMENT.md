# Progression et badges — mise en production

Cette évolution ajoute une route authentifiée `GET /api/progression/me` et la
table `player_badge`. Les statistiques sont calculées depuis les résultats de
parties écrits par le serveur dans `atelier_match_result`. Le téléphone ne peut
plus ajouter lui-même une victoire.

## Ordre de déploiement

Depuis la racine du backend, avec `DATABASE_URL` défini dans `.env` :

```sh
node scripts/catalog/apply-migration.js migrations/progression_v1.sql --dry-run
node scripts/catalog/apply-migration.js migrations/progression_v1.sql
```

La première commande montre la base ciblée sans écrire. Vérifier le nom d’hôte
et le nom de la base, puis lancer la seconde une seule fois. La migration est
transactionnelle et n’efface aucune donnée.

Déployer ensuite le backend sur Railway. Cette fonctionnalité n’ajoute aucune
variable d’environnement. `ATELIER_ENABLED=true` reste nécessaire pour que les
nouvelles parties utilisent l’arbitrage serveur et alimentent
`atelier_match_result`. `ATELIER_ECONOMY_ENABLED` peut rester à `false` : il ne
contrôle que les pièces, achats et récompenses.

Après le déploiement, ouvrir le profil dans l’application avec un compte
connecté. Un rafraîchissement doit appeler `GET /api/progression/me`, afficher
les parties existantes et débloquer automatiquement les badges déjà mérités.
Sans JWT, la route doit répondre `401`.

Le retour contient aussi `newlyUnlockedBadgeIds`, alimenté uniquement par les
lignes réellement insérées dans `player_badge`. Le frontend l’utilise pour
jouer la célébration une seule fois à la fin d’une partie. Le badge
`master-detective` est obtenu après 50 victoires en ligne. Son ajout ne
demande pas de nouvelle migration après `progression_v1.sql`.
