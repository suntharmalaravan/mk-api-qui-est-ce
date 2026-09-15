# Catalogue Super-héros — préparation

Statut : génération bloquée par l’outil intégré le 14 septembre 2026. Aucun portrait généré ni aucune publication de cette catégorie. Superman (deux tentatives) et Batman ont reçu `moderation_blocked` à l’étape de sortie, catégorie `other`, sans motif détaillé.

La sélection proposée contient 12 personnages DC et 12 Marvel dans `scripts/catalog/superheroes.roster.json`. Les descriptions et prompts préparés sont dans `scripts/catalog/superheroes.prompts.json`. Les références téléchargées sont conservées dans `assets/catalog/superheroes/references/` ; `style-reference.png` reprend le Goku approuvé. Les fichiers de référence doivent être inspectés avant usage et ne sont pas destinés à la publication.

Requêtes rejetées : `05f3dbcf-08fc-4d31-a825-f85aab664c58`, `636d259e-cbe1-47a0-a02a-e913f0bc2628`, `c296d693-c809-43bf-93ca-33326b5cd9ed`.

Une fois les 24 portraits générés et contrôlés, les outils de préparation sont disponibles :

```sh
node scripts/catalog/prepare-generated-catalog.js superheroes
node scripts/catalog/verify-generated-catalog.js superheroes
node scripts/catalog/create-contact-sheet.js superheroes assets/catalog/superheroes/contact-sheet.jpg
node scripts/catalog/upload-catalog.js superheroes --dry-run
```

Ne publier qu’après contrôle visuel complet. La préparation exige 24 images carrées d’au moins 768 pixels, produit des JPEG 768 × 768 avec URLs versionnées par empreinte et conserve les PNG originaux. Après l’envoi, vérifier les fichiers publics avec `verify-generated-catalog.js superheroes --remote`, puis créer et contrôler une migration limitée à cette catégorie avant de l’appliquer. La vérification finale ajoute `--database`.

La catégorie anime déjà publiée reste indépendante de cette préparation.
