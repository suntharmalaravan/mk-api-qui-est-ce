# Atelier v1 — intégration et activation

Le code est branché dans les deux dépôts. Ce document n’est pas une confirmation de déploiement.
Aucune migration ni vérification Railway n’a été exécutée par l’agent.

## 1. Prérequis et périmètre

- Backend Nest/TypeORM existant, PostgreSQL 13+ (gen_random_uuid), tables user/deck/image/room/room_image existantes.
- Node >=20.9 pour Sharp 0.35.4 ; utiliser une version Node compatible dans l’image de build ET à l’exécution.
- Installer les dépendances depuis package-lock.json. Sharp est désormais une dépendance runtime.
- Le build Nest copie les six PNG dans dist/atelier/assets. Vérifier leur présence dans l’artefact déployé.
- Les assets et les ancres du catalogue v1 sont figés. Toute évolution incompatible exige une nouvelle version.
- Le dépôt contient aussi des modifications de catalogues non liées à l’atelier : examiner le diff avant tout commit/déploiement.

## 2. Migration explicite

1. Sauvegarder la base et vérifier la procédure de restauration.
2. Garder ATELIER_ENABLED=false et ATELIER_ECONOMY_ENABLED=false.
3. Contrôler la version PostgreSQL, la présence des tables requises et l’absence de atelier_account.
4. Relever les decks déjà au-delà de 21 cartes : ils ne sont pas tronqués par cette migration, mais aucun nouvel ajout n’y sera accepté.
5. Exécuter UNE FOIS migrations/atelier_v1.sql avec arrêt à la première erreur, par exemple dans un shell connecté à la base choisie :

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/atelier_v1.sql
```

La migration est transactionnelle, additive, avec lock_timeout=5s et statement_timeout=60s.
Un échec de verrouillage annule la transaction : résoudre le conflit avant de la relancer.
Ne pas la rejouer si les tables ont déjà été créées. Ne pas activer synchronize.

Elle ajoute les personnages versionnés, portraits, comptes, inventaires, reçus d’opérations,
journal de pièces, résultats de parties, erreurs de devinettes et limite SQL de 21 cartes.
Le trigger limite également les anciennes routes de photos. Il ne supprime aucune image.

## 3. Variables Railway

Copier les noms de .env.atelier.example dans les variables du service, pas dans le code.

| Variable | Valeur initiale | Rôle |
| --- | --- | --- |
| ATELIER_ENABLED | false, puis true après migration | API atelier et verdicts serveur avec deux vies |
| ATELIER_PUBLIC_URL | origine HTTPS publique du backend | Exactement la même origine que API_CONFIG.BASE_URL côté app, sans /api ni chemin |
| ATELIER_ECONOMY_ENABLED | false | Ouverture conjointe des achats et récompenses |
| ATELIER_GOLD_PRICE | 50 | Prix du fond doré |
| ATELIER_WIN_COINS | 10 | Gain du gagnant |
| ATELIER_LOSS_COINS | 3 | Gain du perdant |
| ATELIER_DAILY_CAP | 100 | Plafond quotidien de gains par compte, journée UTC |
| ATELIER_MIN_MATCH_SECONDS | 60 | Durée minimale depuis le choix des deux personnages |
| ATELIER_WRITES_PER_MINUTE | 120 | Limite de mutations confirmées par compte |

Ces montants sont des valeurs de départ configurables, pas un équilibrage validé.
Aucun solde initial gratuit et aucune conversion du score en pièces.
Le bonus de score existant (+8) reste distinct du portefeuille.

Le démarrage échoue explicitement si le module est activé sans son schéma ou avec une
configuration invalide. Déployer d’abord avec les flags désactivés. Attendre la fin des
parties en cours avant de changer ATELIER_ENABLED : les anciennes parties n’ont pas
d’historique serveur de vies. Ne pas mélanger des instances avec des flags différents.

## 4. Contrat HTTP

Toutes les routes /api/atelier nécessitent Authorization: Bearer JWT, sauf portraits/:hash.
L’identité vient exclusivement du JWT signé (id immuable), jamais du body.

| Méthode / route | Données principales |
| --- | --- |
| GET /catalog | Version, slots/IDs, couleurs, limites |
| GET /account | balance, version, owned, prices, purchasesEnabled |
| GET /characters | characters du compte, maximum 60 |
| POST /characters | operationId, id, name, recipe, expectedRevision (0 pour création) |
| DELETE /characters/:id | operationId, expectedRevision dans le body JSON |
| POST /purchases | operationId, itemId, expectedPrice |
| POST /decks | operationId, characters:[{id,revision}], deckId optionnel, name optionnel |
| GET /operations/:id | Reçu confirmé de cette opération pour ce compte ; 404 ne prouve pas un échec en cours |
| GET /portraits/:hash | JPEG public immuable, 512px, <=512KiB |

Recette v1 : catalogVersion:1 et hair, glasses, hat, beard, outfit, backdrop.
Les IDs autorisés sont dans src/atelier/catalog.ts et le même catalogue frontend.
Aucune URL ni image arbitraire n’est acceptée par la création de personnages.

Mutations : opération et reçu sont validés dans la même transaction. Même clé/même demande :
même résultat ; même clé/demande différente : 409. Révisions périmées : 409 sans écrasement.
Un achat verrouille le compte, vérifie prix/solde/possession, puis écrit inventaire et journal
dans la même transaction. Les reçus ne sont pas supprimés automatiquement.

Les publications revalident propriété, révision, possession des objets, doublons visibles
et capacité sous verrou du deck. 18–21 cartes pour un nouveau deck, 1–21 pour compléter.
Le fond et les cheveux masqués par une casquette ne distinguent pas deux suspects.
Les cartes du deck sont des snapshots : modifier ou supprimer le personnage ne les modifie pas.

## 5. Socket.IO et pièces

Connexion JWT existante conservée ; rôle vérifié contre la session et la room.
Quand l’atelier est activé, select est arbitré dans une transaction PostgreSQL :
carte présente sur le plateau, erreur/vies, fin de partie, score et récompenses éventuelles.
Une devinette déjà traitée ne retire pas une deuxième vie. Une partie ne paie qu’une fois.
L’événement déclaratif lost lifes est ignoré dans ce mode.

select result ajoute eventId, livesLeft, terminal. Les secrets ne sont envoyés qu’au résultat
terminal. room resumed inclut lives et lastResult pour rattraper un résultat perdu.
Le frontend réconcilie les vies serveur et ignore les eventId déjà joués.
Le signal character chosen de l’adversaire ne contient plus son personnage.
Les routes HTTP d’une room sont limitées à ses membres et masquent le secret adverse.

Pas de récompense pour un abandon/déconnexion ou une partie trop courte.
La durée minimale et le plafond réduisent les abus, mais ne constituent pas un système
anti-collusion complet. L’autorité sur les questions/tours et leur historique persistant
ne sont pas refondus ici. Ne pas présenter cette économie comme compétitive anti-triche.

## 6. Vérifications à effectuer

Tests sans base réelle :
```sh
npm run build
npx jest src/atelier src/room/room.gateway.spec.ts src/room/room.service.spec.ts --runInBand
```

Tests PostgreSQL opt-in :
- Créer une base dédiée dont le nom finit par _atelier_test ; ne jamais utiliser la base de production.
- Renseigner ATELIER_TEST_DATABASE_URL et ATELIER_RUN_DATABASE_TESTS=true.
- Lancer npx jest src/atelier/postgres.integration.spec.ts --runInBand.
- Le test crée et supprime uniquement son schéma aléatoire. Il exerce les doubles achats,
  CAS concurrents, publication atomique/capacité et règlement simultané d’une partie.
- Sans ces deux variables, cette suite est ignorée. Elle n’a pas été exécutée durant cette livraison.

Smoke test sur ton environnement :
1. Sans JWT : 401 ; avec un second compte : aucune création ni portefeuille du premier visible.
2. Créer/renommer/dupliquer/supprimer ; relancer l’app et retrouver le résultat.
3. Modifier le même personnage depuis deux appareils : un conflit, jamais un écrasement silencieux.
4. Couper le réseau après l’envoi, puis revenir à la bibliothèque : récupération sans doublon.
5. Générer 18 suspects, publier un deck, le renommer, lancer une partie custom avec ce deck.
6. Modifier le personnage source : l’ancienne carte du deck reste identique.
7. Deux erreurs : fin de partie côté serveur ; reconnexion : vies/résultat identiques.
8. Activer l’économie uniquement après ces contrôles ; partie trop courte=0 pièce,
   partie éligible=barème configuré ; répétition du verdict/achat=aucun double crédit/débit.
9. Vérifier achat avec prix changé, solde insuffisant, item déjà possédé et plafond quotidien.
10. Vérifier petit écran/clavier, animations réduites, iOS/Android et reprise après arrière-plan.

## 7. Exploitation et retour arrière

- Désactiver d’abord ATELIER_ECONOMY_ENABLED en cas de problème économique.
- Pour fermer complètement l’atelier, arrêter les nouvelles parties et laisser finir les
  parties actives avant de désactiver ATELIER_ENABLED ; conserver le schéma et les portraits.
- Ne pas DROP les tables ou supprimer les colonnes après utilisation : les cartes publiées
  et reçus en dépendent. Un rollback de code ne doit pas effacer les données.
- Prévoir métriques/alertes sur 409, 429, 5xx, RENDER_BUSY, volume des reçus et du journal.
- Limitation DB par compte et deux rendus simultanés par instance ; compléter par les limites
  réseau/authentification de l’infrastructure. Les échecs rejetés ne consomment pas la limite
  de mutations confirmées.
- Portraits stockés en PostgreSQL : choix v1 pour une validation atomique sans dépendance
  Firebase. 160 recettes possibles, dont 120 rendus visuellement distincts, partagés entre
  comptes. Prévoir un stockage objet/CDN et une stratégie de conservation avant d’étendre
  fortement le catalogue.
- Les anciennes routes de photos Firebase gardent leur workflow d’upload : une interruption
  peut encore laisser des objets orphelins/un deck incomplet. Elles ne sont pas devenues
  idempotentes ; seul le nouveau chemin atelier a cette garantie.
- Les brouillons/anciennes créations sont locaux, non chiffrés, et séparés par compte.
  La suppression du compte purge ces données sur cet appareil après confirmation serveur.
