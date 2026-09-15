# Atelier — variété v4

Huit assets créés avec l’outil intégré `image_gen`. Prompts, références, sorties retenues et empreintes SHA-256 : `docs/atelier-v4-art.json` dans le frontend.

| Pièce | Identifiant | Fichier |
| --- | --- | --- |
| Coupe pixie | hair-pixie | pixie.png |
| Tresses duo | hair-braids | braids.png |
| Béret framboise | hat-beret | beret.png |
| Bob vanille | hat-bucket | bucket.png |
| Lunettes lagon | glasses-rectangular | rectangular.png |
| Veste en jean | outfit-denim | denim.png |
| Marinière | outfit-mariniere | mariniere.png |
| Nœud papillon prune | neckwear-bowtie | bowtie.png |

Les deux coiffures utilisent les douze couleurs existantes. Le nœud papillon partage le slot `neckwear` avec le foulard ; la catégorie s’appelle désormais « Tour de cou ». Toutes les nouvelles pièces sont gratuites. La micro-animation après chargement du rendu reste active.

## Retrait du hoodie lilas

Le hoodie est marqué `retired` : absent du sélecteur, des voisins par balayage, des tirages aléatoires et des kits. Le catalogue backend v4 ne le propose plus et rejette une recette v4 contenant `outfit-hoodie`.

À l’ouverture d’un personnage ou brouillon v2/v3 qui le porte, `editableRecipe` prépare une recette v4 avec le tee-shirt. Le choix des autres pièces, le nom et l’identité du personnage sont conservés. L’historique d’édition démarre après ce remplacement : annuler ne réintroduit pas le hoodie. Aucun ancien portrait publié ni enregistrement serveur n’est réécrit automatiquement ; les versions 1–3 restent lisibles.

## Ajustements visuels

Toutes les images sont des PNG RGBA réellement transparents. Les ancres sont partagées à l’identique entre le rendu React Native et Sharp. Les vêtements conservent une ouverture au cou ; la veste en jean suit le buste. Pour la marinière, le PNG transparent original est retenu avec une échelle de 1,1 et une translation de −0,028 : les ourlets des manches passent sous le bord du portrait et le col reste au niveau du cou. Les retouches ayant produit des fonds opaques ont été écartées. Les lunettes ont des ouvertures transparentes aux deux yeux. Les chapeaux masquent les cheveux ; les tresses se superposent aux vêtements et les accessoires restent au-dessus.

Aucune retouche raster par script : génération et détourage via imagegen, placement via le moteur de calques existant. Les images/ancres v1–v3 sont conservées. Après publication, figer les assets et ancres v4.

## Vérifications du 14 septembre 2026

- 64 assemblages inspectés avec le moteur serveur réel : `docs/atelier-v4-preview.png` et `docs/atelier-v4-combos.png` dans le frontend. Colonnes : original, féminin, ébène, taches de rousseur.
- 82 tests frontend ciblés passent : catalogue, retrait du hoodie, migration, historique, sauvegarde v2/v3/v4, kits et animations.
- 56 tests backend ciblés passent : validation, stockage/relecture, transparence, rendu des pièces sur chaque visage, teintures, droits et decks.
- Les empreintes JPEG historiques v1, v2 et v3 restent identiques.
- TypeScript de l’application (`tsconfig.app.json`) valide ; lint ciblé sans erreur, quatre avertissements `no-void` préexistants dans l’éditeur.
- Compilation Nest et bundles Metro iOS/Android validés, PNG vérifiés entre les sources et les sorties compilées.
- Pas de test sur appareil/simulateur, de déploiement ni de test PostgreSQL réel pendant cette modification.

## Reproduire et mettre en service

Depuis le frontend :

```sh
node scripts/preview-character-catalog.cjs /chemin/absolu/backend /chemin/absolu/pieces.png 4
node scripts/preview-character-catalog.cjs /chemin/absolu/backend /chemin/absolu/combinaisons.png 4-combos
npx jest --runInBand --watchman=false --runTestsByPath __tests__/characterCatalogV2.test.ts __tests__/characterCatalogV3.test.ts __tests__/characterCatalogV4.test.ts __tests__/characterEditorV2.test.tsx __tests__/characterMotion.test.tsx __tests__/characterStudio.test.ts __tests__/characters.test.ts __tests__/characterApi.test.ts __tests__/characterBatch.test.ts __tests__/characterFlows.test.tsx __tests__/characterLayout.test.ts
npx tsc --noEmit -p tsconfig.app.json
```

Depuis le backend :

```sh
npm test -- --runInBand --watchman=false --runTestsByPath src/atelier/atelier.spec.ts src/atelier/access.spec.ts src/atelier/mixed-deck.spec.ts src/atelier/portrait.spec.ts src/atelier/catalog-v2.spec.ts src/atelier/catalog-v3.spec.ts src/atelier/catalog-v4.spec.ts
npm run build
```

Déployer d’abord l’API et ses huit PNG. Le catalogue doit annoncer `catalogVersion: 4`, `rendererVersion: 4`, `supportedCatalogVersions: [1,2,3,4]`, sans hoodie dans `slots.outfit`. Distribuer ensuite l’application. Aucune migration SQL supplémentaire : les recettes utilisent déjà JSONB. Le JPEG serveur demeure l’image publiée ; les contours de l’aperçu natif peuvent varier légèrement selon la plateforme.
