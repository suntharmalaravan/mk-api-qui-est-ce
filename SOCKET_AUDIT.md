# Audit de la gestion Socket.IO

Date : 6 septembre 2026

## Synthèse

L'implémentation initiale compilait, mais son cycle de vie n'était pas fiable
en production. La déconnexion était recherchée dans les rooms Socket.IO après
que Socket.IO en avait déjà retiré le client. Chaque déconnexion déclenchait
en plus un scan de toutes les rooms en base. Enfin, l'identité et le rôle étaient
acceptés depuis le payload : un client pouvait agir comme un autre joueur et
déclencher les handlers de score.

Les risques bloquants ont été corrigés sans changer les noms des événements
existants. Le client doit désormais fournir son JWT au handshake et émettre
`resume` après une reconnexion.

## Constat et traitement

| Sévérité | Constat                                                                                                        | Traitement                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Critique | `handleDisconnect` cherchait le socket après son retrait des rooms ; le nettoyage était normalement inopérant. | Session attachée à `socket.data`, nettoyage direct par identifiant de room et délai de reprise.                           |
| Critique | Aucune authentification WebSocket ; `userId` et `player` étaient usurpables.                                   | Middleware de handshake JWT, existence utilisateur vérifiée, identité et rôle liés côté serveur.                          |
| Critique | `select` et `lost lifes` pouvaient être rejoués pour ajouter plusieurs fois 8 points.                          | Transition atomique `closed -> finished` et incrément SQL atomique du score.                                              |
| Haute    | Deux clients pouvaient rejoindre simultanément la même place de guest.                                         | `UPDATE ... WHERE status = 'open' AND guestplayerid IS NULL`, avec contrôle de `affected`.                                |
| Haute    | Le départ de l'host avant le début rouvrait une room orpheline.                                                | Le guest rouvre la room avant partie ; le départ de l'host supprime la room.                                              |
| Haute    | Toute micro-coupure terminait la partie.                                                                       | Fenêtre de reprise de 10 s, événement authentifié `resume`, annulation du nettoyage si une socket de remplacement existe. |
| Haute    | Une socket pouvait émettre dans une room qu'elle n'avait pas rejointe ou sous le rôle adverse.                 | Garde centralisée sur tous les événements de jeu.                                                                         |
| Moyenne  | Le mode custom d'un guest perdait `mode`, `deck_id` et le propriétaire lors du join.                           | `addGuest` retourne maintenant les détails complets et le chargement des images est centralisé.                           |
| Moyenne  | Un deck custom pouvait être sélectionné sans vérifier son propriétaire.                                        | Chargement initial par `(deckId, authenticatedUserId)`.                                                                   |
| Moyenne  | CORS Socket.IO acceptait `*`.                                                                                  | Liste `SOCKET_CORS_ORIGINS`; localhost uniquement par défaut en développement.                                            |
| Moyenne  | Noms de room et contenus n'étaient pas bornés dans le gateway.                                                 | Validation centralisée des noms, identifiants et tailles des messages critiques.                                          |
| Moyenne  | Les JWT nouvellement émis n'expiraient jamais.                                                                 | Durée `JWT_EXPIRES_IN`, `1d` par défaut.                                                                                  |

## Contrat d'exploitation

Variables requises ou recommandées :

- `SECRET` : secret JWT fort, obligatoire et identique sur toutes les instances ;
- `JWT_EXPIRES_IN=1d` : durée des nouveaux tokens ;
- `SOCKET_CORS_ORIGINS=https://app.example.com` : origines navigateur, séparées par des virgules ;
- `SOCKET_DISCONNECT_GRACE_MS=10000` : compromis entre reprise réseau et vitesse de libération d'une room.

Avant déploiement :

1. Appliquer `migrations/socket_room_hardening.sql`.
2. Déployer le client avec `auth: { token: accessToken }` dans `io(...)`.
3. Conserver le nom de la room courante et émettre `resume: { name }` au
   `connect` suivant une coupure.
4. Configurer les origines de production.
5. Surveiller les erreurs structurées `UNAUTHORIZED`, `FORBIDDEN`,
   `GAME_ALREADY_FINISHED`, `ROOM_NOT_FOUND` et `RESUME_FAILED`.

## Risques résiduels et suite recommandée

- Le serveur utilise encore l'adapter Socket.IO en mémoire et un timer local.
  Il faut rester à **une instance**. Avant un passage horizontal, installer un
  adapter Redis et remplacer le timer local par un lease/job partagé et
  idempotent.
- L'état du tour, les questions/réponses et l'accord de rematch restent
  principalement en mémoire/client. Une vraie machine d'état persistée est
  nécessaire si ces règles doivent être autoritaires.
- Il n'y a pas encore de quota par socket/IP. Ajouter un rate limiter au niveau
  du reverse proxy et des événements avant une exposition publique importante.
- Les logs historiques du gateway sont très verbeux et certains incluent le
  contenu des messages. Les convertir en logs structurés avec niveau et
  corrélation, sans contenu utilisateur, est recommandé.
- La suite Jest historique du dépôt comporte plusieurs tests cassés sans lien
  avec cet audit (providers TypeORM/JWT non mockés et un DTO absent). Le test
  ciblé du cycle socket est vert ; la suite globale doit être remise à niveau
  avant de devenir une gate CI fiable.
