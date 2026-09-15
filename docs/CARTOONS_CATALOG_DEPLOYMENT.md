# Catalogue Dessins animés — 24 portraits 3D

Catégorie `cartoons` : D’Jok, Micro-Ice, Marsupilami, Sammy, Gumball, Darwin, Ben 10, Ladybug, Chat Noir, Sam, Clover, Alex, Tag, Corneil, Bernie, Dora, Aang, Katara, Finn, Jake, Boom, Titeuf, Oggy et Garfield.

Les huit ajouts choisis par l’utilisateur sont D’Jok, Micro-Ice, Marsupilami, Tag, Corneil, Bernie, Dora et Boom. Boom a été retenu pour Linus et Boom et généré en priorité. Les personnages refusés lors de la sélection initiale ne figurent pas dans le catalogue final.

## Fichiers et génération

- `scripts/catalog/cartoons.roster.json` : sélection finale, références et fichiers retenus.
- `scripts/catalog/cartoons.prompts.json` : prompts exacts de l’outil intégré `image_gen`, avec les corrections du fond de Jake et D’Jok.
- `assets/catalog/cartoons/` : originaux PNG, exports JPEG 768 × 768, manifeste et `contact-sheet.jpg`.
- `assets/catalog/cartoons/references/` : références téléchargées et inspectées pour identifier les personnages ; elles ne sont pas publiées.

Le portrait de Goku approuvé précédemment sert de référence de style 3D. Les originaux sont conservés, y compris les premières versions de Jake et D’Jok. Le manifeste retient leurs versions `v2` avec fond lavande opaque. Les références et descriptions de Boom, Micro-Ice, Corneil et Bernie ont été ajustées après inspection visuelle. Aucune licence libre n’est attribuée aux personnages. Le dossier `assets/` reste local conformément au `.gitignore` existant.

## Publication

```sh
node scripts/catalog/check-connections.js
node scripts/catalog/prepare-generated-catalog.js cartoons
node scripts/catalog/verify-generated-catalog.js cartoons
node scripts/catalog/create-contact-sheet.js cartoons assets/catalog/cartoons/contact-sheet.jpg
node scripts/catalog/upload-catalog.js cartoons --dry-run
node scripts/catalog/upload-catalog.js cartoons
node scripts/catalog/verify-generated-catalog.js cartoons --remote
node scripts/catalog/apply-migration.js migrations/add_category_cartoons.sql
node scripts/catalog/verify-generated-catalog.js cartoons --remote --database
```

Inspecter la planche avant publication. Les URL publiques contiennent une empreinte du contenu sous `catalog/cartoons/v1/`, avec un cache d’un an. Vérifier les 24 fichiers publics avant la transaction SQL. La migration utilise les colonnes et l’index existants, limite les écritures au catalogue officiel `cartoons`, contrôle les 24 lignes avant validation et peut être rejouée sans doublons.

`ImageService.getCategories()` lit les catégories dynamiquement et exclut celles masquées ou ayant moins de 18 images. Cette livraison de données ne nécessite pas de redéploiement du code de l’API.

## Retour arrière

Masquer la catégorie en conservant les images pour les parties existantes :

```sql
INSERT INTO category_setting (slug, visible) VALUES ('cartoons', false)
ON CONFLICT (slug) DO UPDATE SET visible = false;
```

Pour réactiver la catégorie, utiliser `visible = true`.

## Validation

Publication effectuée le 15 septembre 2026 : 24 noms uniques, JPEG 768 × 768, empreintes SHA-256 locales et publiques conformes et planche inspectée. Exports : 1 327 Ko au total. La base contient les 24 noms et URL exacts du manifeste ; la catégorie est visible et jouable. Les dix catégories préexistantes conservent leurs effectifs. Les 24 prompts et leurs références locales sont présents.

La validation porte sur les données et les fichiers de cette livraison ; aucun code applicatif n’est modifié. La suite de tests applicatifs n’a pas été relancée.
