# Catalogue anime — 24 portraits 3D

Catégorie `anime` : Dragon Ball (4), Naruto (4), One Piece (4), Demon Slayer (4), Death Note (2), L’Attaque des Titans (3), My Hero Academia (2), Bleach (1).

## Fichiers et génération

- `scripts/catalog/anime.roster.json` : noms, univers, références visuelles sélectionnées et fichiers PNG.
- `scripts/catalog/anime.prompts.json` : prompts exacts utilisés avec l’outil intégré `image_gen`, dont la correction de cadrage de Vegeta.
- `assets/catalog/anime/` : PNG originaux, JPEG 768 × 768, manifeste et planche `contact-sheet.jpg`.
- `assets/catalog/anime/references/` : références de personnages ; elles ne sont pas publiées.

Le portrait de Goku approuvé sert de référence de style à chaque génération. Les autres références servent à reconnaître les personnages. Les portraits générés ne sont pas déclarés sous une licence libre. Le dossier `assets/` reste local, conformément au `.gitignore` existant ; conserver une sauvegarde des PNG, car relancer une génération ne reproduit pas exactement les mêmes pixels.

## Publication

```sh
node scripts/catalog/check-env.js
node scripts/catalog/check-connections.js
node scripts/catalog/prepare-anime-catalog.js
node scripts/catalog/verify-anime-catalog.js
node scripts/catalog/create-contact-sheet.js anime assets/catalog/anime/contact-sheet.jpg
node scripts/catalog/upload-catalog.js anime --dry-run
node scripts/catalog/upload-catalog.js anime
node scripts/catalog/verify-anime-catalog.js --remote
node scripts/catalog/apply-migration.js migrations/add_category_anime.sql
node scripts/catalog/verify-anime-catalog.js --remote --database
```

Contrôler visuellement la planche avant l’envoi. Les chemins publics contiennent une empreinte du contenu sous `catalog/anime/v1/` : une nouvelle image obtient une nouvelle URL, compatible avec le cache d’un an du script existant. Publier et vérifier les 24 fichiers avant la transaction SQL pour éviter une catégorie partielle. La migration est limitée au catalogue officiel `anime` et peut être rejouée sans doublons. Les 24 noms et URL doivent correspondre au manifeste.

Les catégories sont lues dynamiquement par `ImageService.getCategories()` et le back-office. Le seuil de jouabilité est de 18 images ; cette série en contient 24. Aucun redéploiement de code de l’API n’est nécessaire pour cette insertion.

## Retour arrière

Masquer la catégorie évite de supprimer les images référencées dans les parties existantes :

```sql
INSERT INTO category_setting (slug, visible) VALUES ('anime', false)
ON CONFLICT (slug) DO UPDATE SET visible = false;
```

Pour la réactiver, mettre `visible = true`. Conserver les fichiers publics pour les parties existantes.

## Validation

Publication effectuée le 14 septembre 2026 : 24 exports publics vérifiés par SHA-256, 24 lignes officielles `anime` insérées, catégorie visible. Les huit catégories préexistantes conservent leurs effectifs. Exports JPEG : environ 1,5 Mo au total ; les originaux restent en local.

Le vérificateur contrôle les 24 noms attendus, l’absence de doublons, le format JPEG, les dimensions et les empreintes locales. `--remote` télécharge les 24 URL sans authentification et compare leurs empreintes. `--database` contrôle les 24 lignes officielles et la visibilité de la catégorie.

Les 11 tests de `lobby.service.spec.ts` passent. Le test préexistant `image.service.spec.ts` ne configure pas `ImageRepository`, `DeckRepository` et `DataSource` et échoue au montage du module ; aucun code applicatif n’est modifié par cette livraison de catalogue.
