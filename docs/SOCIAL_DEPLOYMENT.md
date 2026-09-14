# Identifiants, amis et classements permanents

## Livraison

Le frontend et le backend sont modifiés sur leurs branches courantes. Aucun push
ni déploiement n’est effectué. La migration de production reste à appliquer au
moment du déploiement du backend ; les tests PostgreSQL utilisent uniquement un
schéma temporaire isolé, supprimé à la fin.

## Contrat

- `public_identifier` est l’identifiant public unique, indépendant du nom affiché
  et de l’ID interne numérique. Les nouveaux identifiants comportent 3–20 lettres
  ASCII, chiffres ou `_`, et sont uniques sans distinction de casse.
- La migration conserve les comptes, mots de passe, IDs, noms et résultats.
  Les anciens noms en collision de casse reçoivent un suffixe `_ID` sur leur
  identifiant public. Les anciens identifiants de connexion exacts fonctionnent
  toujours. Les futurs fournisseurs Google/Apple ont une table `auth_identity`
  qui associe un couple fournisseur/subject unique à l’ID interne. Aucune connexion
  OAuth n’est activée dans cette livraison.
- `GET /api/leaderboard?scope=world|friends` : victoires cumulées dans les résultats
  de duels validés par le serveur. Les amis acceptés et le joueur sont filtrés
  avant le calcul de leur rang. Le top 50 et la place personnelle sont renvoyés.
  Départage : victoires, moins de parties, date de dernière victoire, ID.
  Pas de remise à zéro. L’ancien endpoint `/daily` reste compatible.
- `GET /api/social` : amis, demandes entrantes/sortantes, défis encore disponibles,
  identifiant public du joueur connecté. HTTP authentifié ; aucune donnée sensible.
- `POST /api/social/friends {identifier}` ; `POST /friends/:id/accept` ;
  `DELETE /friends/:id` pour refuser, annuler ou retirer.
- `POST /api/social/invitations {recipientId,roomName}` ;
  `DELETE /invitations/:id` pour décliner ou annuler.
- L’acceptation utilise le socket existant `join` avec `{name,userId,invitationId}`.
  Destinataire, amitié, expiration et disponibilité sont vérifiés ; la place et
  l’invitation sont validées dans la même transaction. Une répétition avant le
  début de la sélection est idempotente. Une seule acceptation concurrente gagne.
- `GET /api/social/players/:id` ne renvoie que le profil public et la relation
  avec le demandeur. L’écran de résultat utilise l’ID de l’adversaire déjà connu
  pour permettre l’ajout même après suppression du salon.
- `GET /api/social/opponents/:roomName` ne rend l’adversaire qu’aux membres d’un
  duel terminé, pour demander ou accepter son amitié depuis l’écran de résultat.

## Parcours et limites

Classement → Mondial / Amis → Mes amis. Ajouter par identifiant, accepter/refuser,
retirer, défier. Un défi fait choisir le thème, crée un salon puis invite l’ami.
Le salon permet également d’inviter directement un ami, y compris avec un deck
personnalisé déjà sélectionné. Le destinataire accepte et rejoint le même lobby.
Les défis expirent après cinq minutes. La liste est réactualisée toutes les dix
secondes tant que l’application est active, et au retour au premier plan. Il
n’y a pas de notification push OS quand l’application est fermée. Une invitation
n’interrompt pas une partie en cours ; elle est accessible ensuite si valide.

Le classement reflète l’historique réellement présent dans `atelier_match_result`,
qui ne permet pas de reconstruire des victoires antérieures jamais enregistrées.
Le serveur garde la logique de validation et de récompense des duels existante.

## Vérifications et déploiement ultérieur

```sh
npm run build
npx jest src/auth/auth.service.spec.ts src/room/room.gateway.spec.ts src/room/room.service.spec.ts src/leaderboard/leaderboard.service.spec.ts --runInBand
# PostgreSQL dédié ou schéma isolé autorisé :
SOCIAL_TEST_DATABASE_URL=... SOCIAL_TEST_SSL=true node scripts/test-social-postgres.cjs
# Seulement lors du futur déploiement :
node scripts/catalog/apply-migration.js migrations/social_v1.sql --dry-run
node scripts/catalog/apply-migration.js migrations/social_v1.sql
```

Ordre : migration, backend, app. Un trigger d’insertion fournit l’identifiant
public aux inscriptions servies pendant la transition par l’ancienne API.
Les contraintes uniques arbitrent les inscriptions concurrentes. La migration
est transactionnelle et relançable. Une collision de suffixes inattendue fait
échouer la migration atomiquement et doit être résolue avant le déploiement.

Retour arrière : revenir au code backend antérieur et conserver le schéma additif,
les relations et les identifiants. Ne pas supprimer les nouvelles tables après
leur utilisation. La version mobile qui contient les amis nécessite la nouvelle API.

Contrôle manuel restant, confié à l’utilisateur : petits écrans, clavier,
animations réduites, deux appareils avec demandes croisées, défi reçu en dehors
du classement, acceptation après coupure réseau, invitation expirée, ajout de
l’adversaire après victoire et défaite, connexion des deux anciens comptes dont
les noms diffèrent uniquement par la casse.
