# Back office — Qui est-ce ?

Next.js 16 (App Router, React 19, React Compiler), Tailwind v4, Postgres via `postgres.js`.
L'app lit la base de l'API directement depuis le serveur (Server Components et
Server Actions) : pas d'aller-retour HTTP vers Nest, pas de JavaScript de
chargement de données côté navigateur.

| Page | Contenu |
|---|---|
| `/` | KPI 7 jours, parties terminées par jour, derniers inscrits et decks |
| `/users` | Joueurs : recherche (`/`), tri par colonne, pagination, statistiques |
| `/users/[id]` | Fiche joueur : score, parties, taux de victoire, decks, dernières parties |
| `/loupes`, `/loupes/export` | Soldes, gains/dépenses, journal, attributions de duel et export CSV de la page filtrée |
| `/decks`, `/decks/[id]` | Tous les decks créés et leurs cartes |
| `/categories` | Visibilité des catégories du catalogue dans l'app |

Raccourcis : `⌘K` menu de commandes et recherche globale, `G` puis `H` / `U` / `D` / `C`
pour naviguer, `/` pour la recherche de la page.

## Mise en route

1. Appliquer **`migrations/admin_backoffice_v1.sql`** sur la base, **avant** de
   déployer l'API qui lit `category_setting`.
2. Configurer l'environnement :

   ```bash
   cp .env.example .env.local
   npm run hash-password -- 'un-mot-de-passe-long'   # → ADMIN_PASSWORD_HASH
   openssl rand -base64 48                            # → ADMIN_SESSION_SECRET
   ```

3. Lancer :

   ```bash
   npm install
   npm run dev          # http://localhost:3100
   npm run build && npm start
   ```

Déploiement Railway : service séparé, *Root Directory* `admin`, build `npm run build`,
start `npm start`, mêmes variables que `.env.example`.

## Visibilité des catégories

Une catégorie est l'ensemble des images du catalogue (`image.user_id IS NULL`) qui
partagent un `image.category`. La table `category_setting` ne stocke que les
exceptions : **sans ligne, une catégorie est visible**, donc celles ajoutées par
`add_category_<slug>.sql` apparaissent sans étape supplémentaire.

Masquer une catégorie, côté API :

- la retire de `GET /api/images/categories` ;
- refuse sa sélection à la création de room (`create`, `rematch`) et au changement
  de thème du lobby ;
- laisse jouables les salons déjà configurés dessus.

## Sécurité

- Un seul compte admin, défini par `ADMIN_EMAIL` et `ADMIN_PASSWORD_HASH` (scrypt).
  Réponse en temps constant, que l'email soit juste ou non.
- Session : JWT HS256 dans un cookie `httpOnly`, `SameSite=Lax`, `Secure` en
  production, valable 12 h. Changer `ADMIN_SESSION_SECRET` ou `ADMIN_EMAIL` révoque
  toutes les sessions.
- `proxy.ts` redirige tôt, mais **l'autorisation qui fait foi est `requireAdmin()`**,
  appelée par chaque requête de données et chaque Server Action.
- Connexion limitée à 5 essais / 15 min par client et 50 au total. Ces compteurs
  vivent en mémoire : avec plusieurs instances, les porter dans un stockage partagé.
- En-têtes `X-Frame-Options: DENY`, `noindex`, `nosniff`.

### Rôle Postgres dédié (recommandé)

L'app n'a besoin que de lire, et d'écrire dans `category_setting`. Un rôle dédié
l'empêche aussi de lire les hash de mots de passe des joueurs :

```sql
CREATE ROLE mk_admin LOGIN PASSWORD '...';
GRANT SELECT (id, username, score, image_url, created_at) ON "user" TO mk_admin;
GRANT SELECT ON deck, image, "level", atelier_match_result, player_badge,
  atelier_character, atelier_account, category_setting TO mk_admin;
GRANT INSERT, UPDATE ON category_setting TO mk_admin;
```

## Performance

- Rendu serveur en streaming : chaque section a sa frontière `Suspense`, la
  navigation affiche un squelette instantané (`loading.tsx`).
- Listes paginées en deux temps : la page de 50 identifiants est choisie d'abord,
  les agrégats (decks, victoires…) ne sont calculés que pour ces lignes.
- Index ajoutés par la migration sur `atelier_match_result(winner_id)` et
  `(loser_id)` ; la courbe d'activité filtre `finished_at` par bornes pour rester
  indexable.
- Recherche et tri portés par l'URL, en transition : les résultats précédents
  restent affichés pendant le chargement, sans flash.
- Pool de connexions unique par processus, `statement_timeout` de 10 s.

## Suivi des loupes

La rubrique Loupes et les fiches joueurs lisent les soldes et les opérations validées dans `atelier_account`, `atelier_ledger` et `loupe_reward`. La monnaie reste calculée par le serveur du jeu : le back-office ne crédite et ne débite rien.

- Soldes actuels pour tous les joueurs, y compris ceux sans portefeuille (0). Tri par solde, gains ou dépenses.
- Filtres de joueur, période glissante de 7/30 jours ou historique complet ; filtre de type dans le journal.
- Les dépenses d’atelier sont séparées de l’initialisation et des autres ajustements négatifs.
- Journal paginé par identifiant bigint, sans conversion JavaScript en nombre. La lecture des pages suivantes reste stable si de nouvelles opérations arrivent.
- Attributions de duel, y compris à zéro : rapidité, précision, niveau, réduction, plafond et acquittement. Elles expliquent les crédits et ne doivent pas être additionnées une seconde fois au journal.
- CSV limité à la page filtrée (50 lignes), accessible uniquement à l’admin, sans cache, avec neutralisation des formules dans les champs texte.
- L’historique porte sur les écritures conservées en base. Les tentatives d’achat refusées ne créent pas d’écriture financière ; les suppressions de compte suivent les cascades existantes.

Appliquer `migrations/admin_loupes_v1.sql` : trois index de lecture et, si le rôle `mk_admin` existe, lecture des deux tables de suivi. Aucun solde, XP, inventaire ou reçu n’est réinitialisé. Les grades utilisent désormais les niveaux 1, 3, 5, 8, 11, 14, 16 et 18, avec les paliers XP existants de la base.

L’asset monétaire est une copie de celui du mobile dans `public/images/loupe.png`. Les requêtes et exports contrôlent systématiquement `requireAdmin()`. Test : `LOUPE_ADMIN_TEST_DATABASE_URL=... LOUPE_ADMIN_TEST_SSL=true node scripts/test-loupes.cjs` ; les fixtures et index de test sont créés dans un schéma isolé puis annulés.
