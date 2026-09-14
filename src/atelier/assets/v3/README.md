# Atelier — pack v3

Six PNG RGBA générés avec l’outil intégré `image_gen`, puis détourés avec le même outil. Aucune retouche raster par script. Prompts complets, sorties retenues et SHA-256 : `docs/atelier-v3-art.json` dans le frontend.

- Deux visages : ébène et taches de rousseur, soit quatre bases compatibles avec toutes les pièces.
- Bonnet corail, lunettes aviateur dorées, veste campus verte et crème.
- Foulard marine et turquoise dans la catégorie indépendante « Foulards ». Il se combine avec le casque.
- Pièces gratuites, sans nouveau prix ni achat.

## Rendu et conservation des recettes

Le contrat `catalogContract.ts` et les fichiers PNG sont identiques côté React Native et API. Les ancres des versions publiées v1/v2 ne changent pas. Les recettes v1/v2 restent valides et leurs JPEG historiques sont testés octet par octet. Sélectionner une nouvelle pièce migre explicitement la recette vers v3 et ajoute `neckwear`. Annuler restaure la version précédente. Les nouveaux personnages et kits utilisent v3.

Ordre : visage, tenue, foulard, cheveux, barbe, lunettes, chapeau, casque. Un chapeau masque les cheveux sans perdre le choix de coupe/couleur. Le foulard reste visible sous les cheveux longs et au-dessus des tenues. Les variations invisibles de cheveux et de fond ne permettent pas de contourner la détection des doublons. Les kits distribuent les quatre visages dès quatre personnages.

L’éditeur produit une impulsion d’échelle de 1,8 % pendant 300 ms après chargement de tous les calques d’un nouveau rendu. Elle accompagne sélection, annuler/rétablir et tirage aléatoire, ne se répète pas sur une apparence identique, s’arrête lors d’un changement rapide et respecte la réduction des animations et l’état de l’application. L’export reste statique.

## Contrôle du 14 septembre 2026

- 76 tests frontend ciblés passent, dont sauvegarde complète v2/v3, historique et comportement des animations.
- 48 tests backend ciblés passent : validation, sauvegarde/relecture, droits, decks, déterminisme et transparence réelle des six nouveaux assets.
- Compilation Nest réussie ; les six PNG sont inclus dans `dist/atelier/assets/v3`.
- Bundles Metro iOS et Android réussis, nouveaux PNG inclus.
- 56 assemblages inspectés visuellement avec le véritable moteur serveur : `docs/atelier-v3-preview.png` et `docs/atelier-v3-legacy-preview.png` dans le frontend. Les quatre colonnes sont les visages original, féminin, ébène, taches de rousseur. Le script vérifie aussi l’identité des contrats et des PNG entre les deux projets.
- Lint frontend ciblé sans erreur ; quatre avertissements `no-void` préexistants dans l’éditeur.
- TypeScript frontend global : neuf erreurs préexistantes `process/global` dans `_diagTurnSync.test.tsx`, aucune nouvelle erreur de l’atelier.
- Aucun test sur téléphone/simulateur, ni déploiement, ni test PostgreSQL réel. La suite backend globale contient des tests hors atelier déjà incomplets (dépendances Nest non fournies) ; les résultats ci-dessus concernent les six suites ciblées.

## Reproduire

Depuis le frontend :

```sh
node scripts/preview-character-catalog.cjs /chemin/absolu/backend /chemin/absolu/preview.png 3
node scripts/preview-character-catalog.cjs /chemin/absolu/backend /chemin/absolu/legacy.png 3-legacy
npx jest --runInBand --watchman=false --runTestsByPath __tests__/characterCatalogV2.test.ts __tests__/characterCatalogV3.test.ts __tests__/characterEditorV2.test.tsx __tests__/characterMotion.test.tsx __tests__/characterStudio.test.ts __tests__/characters.test.ts __tests__/characterApi.test.ts __tests__/characterBatch.test.ts __tests__/characterFlows.test.tsx __tests__/characterLayout.test.ts
```

Depuis le backend :

```sh
npm test -- --runInBand --watchman=false --runTestsByPath src/atelier/atelier.spec.ts src/atelier/access.spec.ts src/atelier/mixed-deck.spec.ts src/atelier/portrait.spec.ts src/atelier/catalog-v2.spec.ts src/atelier/catalog-v3.spec.ts
npm run build
```

## Mise en service

Déployer d’abord le backend avec ses PNG et vérifier que `/api/atelier/catalog` annonce `catalogVersion: 3`, `rendererVersion: 3`, `supportedCatalogVersions: [1, 2, 3]`, ainsi que `neckwear`. Distribuer ensuite l’application. Aucune migration SQL supplémentaire : les recettes sont stockées en JSONB. Les rendus serveur sont les images publiées ; les contours de l’aperçu natif peuvent varier légèrement selon la plateforme. Figer les images et ancres v3 après publication.
