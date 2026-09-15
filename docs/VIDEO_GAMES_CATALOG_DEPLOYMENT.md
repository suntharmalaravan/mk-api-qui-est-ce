# Catalogue Jeux vidéo — 24 portraits 3D

Catégorie `video_games` : Rayman, Ratchet, Clank, Crash Bandicoot, Coco Bandicoot, Spyro, Sonic, Tails, Knuckles, Shadow, Amy Rose, Dr Eggman, Pac-Man, Mega Man, Ryu, Chun-Li, Ken, Lara Croft, Kratos, Aloy, Steve, Alex, Sackboy et Sly Cooper.

## Fichiers et génération

- `scripts/catalog/video_games.roster.json` : sélection, références vérifiées et fichiers retenus.
- `scripts/catalog/video_games.prompts.json` : prompts exacts utilisés avec l’outil intégré `image_gen`, dont la correction du fond de Pac-Man.
- `assets/catalog/video_games/` : originaux PNG, exports JPEG 768 × 768, manifeste et planche `contact-sheet.jpg`.
- `assets/catalog/video_games/references/` : références téléchargées pour identifier les personnages ; elles ne sont pas publiées.

Le portrait de Goku approuvé pour la catégorie anime sert de référence de style. Les références de Coco, Alex et Sly ont été remplacées après inspection : les images initialement téléchargées représentaient un logo ou un autre personnage. La sélection initiale a été révisée après les refus du générateur pour Mario et Peach ; seuls les 24 personnages ci-dessus figurent au manifeste final.

Les portraits sont des créations générées, sans attribution d’une licence libre aux personnages. Le dossier `assets/` reste local conformément au `.gitignore` existant. Conserver les PNG : une nouvelle génération ne reproduit pas exactement les mêmes pixels.

## Publication

```sh
node scripts/catalog/check-connections.js
node scripts/catalog/prepare-generated-catalog.js video_games
node scripts/catalog/verify-generated-catalog.js video_games
node scripts/catalog/create-contact-sheet.js video_games assets/catalog/video_games/contact-sheet.jpg
node scripts/catalog/upload-catalog.js video_games --dry-run
node scripts/catalog/upload-catalog.js video_games
node scripts/catalog/verify-generated-catalog.js video_games --remote
node scripts/catalog/apply-migration.js migrations/add_category_video_games.sql
node scripts/catalog/verify-generated-catalog.js video_games --remote --database
```

Inspecter la planche avant publication. Les URL publiques contiennent l’empreinte du contenu sous `catalog/video_games/v1/`, compatible avec le cache d’un an. Vérifier les 24 fichiers publics avant la transaction SQL pour éviter une catégorie partielle. La migration utilise les colonnes et l’index existants, limite les écritures au catalogue officiel `video_games`, contrôle les 24 lignes avant validation et peut être rejouée sans doublons.

Les catégories sont lues dynamiquement par `ImageService.getCategories()` et le back-office. Cette livraison de données ne nécessite pas de redéploiement du code de l’API. Le seuil de jouabilité est de 18 images ; cette série en contient 24.

## Retour arrière

Masquer la catégorie sans supprimer les images utilisées par les parties existantes :

```sql
INSERT INTO category_setting (slug, visible) VALUES ('video_games', false)
ON CONFLICT (slug) DO UPDATE SET visible = false;
```

Pour réactiver la catégorie, utiliser `visible = true`. Conserver les fichiers publics pour les parties existantes.

## Validation

Publication effectuée le 15 septembre 2026 : 24 noms attendus, 24 fichiers distincts, JPEG 768 × 768, empreintes SHA-256 locales et publiques conformes, planche inspectée. Exports : 1 612 Ko au total. La base contient les 24 noms et URL exacts du manifeste ; la catégorie est visible et dépasse le seuil de jouabilité. Les neuf catégories préexistantes conservent leurs effectifs.

La validation porte sur les données et les fichiers de cette livraison. Aucun code applicatif n’est modifié ; la suite de tests applicatifs n’a pas été relancée.
