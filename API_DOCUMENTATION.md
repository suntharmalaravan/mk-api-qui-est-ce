# 🎮 API Documentation - Jeu "Qui est-ce ?"

## 📋 Informations générales

- **URL de base** : `http://localhost:8080`
- **Framework** : NestJS + Socket.IO
- **Authentification** : JWT Bearer Token
- **Base de données** : PostgreSQL + TypeORM

## 🔐 Authentification

Toutes les routes API (sauf `/register` et `/login`) nécessitent un token JWT dans le header :

```
Authorization: Bearer <your-jwt-token>
```

---

## 🚀 REST API Endpoints

### 👤 **Authentification**

#### `POST /register`

Créer un nouveau compte utilisateur.

**Body :**

```json
{
  "username": "string", // 3-20 caractères, lettres/chiffres/_
  "password": "string" // 6-50 caractères
}
```

**Réponse :**

```json
{
  "id": 1,
  "username": "john_doe",
  "score": 0
}
```

#### `POST /login`

Se connecter et obtenir un token JWT.

**Body :**

```json
{
  "username": "string",
  "password": "string"
}
```

**Réponse :**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 👥 **Utilisateurs**

#### `GET /api/users/:id`

Récupérer les informations d'un utilisateur.

**Headers :** `Authorization: Bearer <token>`

**Réponse :**

```json
{
  "id": 1,
  "username": "john_doe",
  "score": 150,
  "title": "debutant",
  "image_url": "https://storage.googleapis.com/your-bucket/profiles/1.png"
}
```

**Note :** `image_url` peut être `null` si l'utilisateur n'a pas uploadé d'image de profil.

#### `PATCH /api/users/:id/scores`

Mettre à jour le score d'un utilisateur.

**Headers :** `Authorization: Bearer <token>`

**Body :**

```json
{
  "score": 200
}
```

#### `DELETE /api/users/:id`

Supprimer son propre compte utilisateur.

**Headers :** `Authorization: Bearer <token>`

#### `POST /api/users/:id/images`

Uploader une image de profil utilisateur vers Firebase Storage.

**Headers :** `Authorization: Bearer <token>`

**Content-Type :** `multipart/form-data`

**Body :**

- `image` (file) : Image à uploader (JPG, JPEG, PNG, GIF, WebP - max 5MB)

**Réponse :**

```json
{
  "success": true,
  "message": "Image de profil uploadée avec succès",
  "imageUrl": "https://storage.googleapis.com/your-bucket/profiles/123.png",
  "userId": 123
}
```

**Notes :**

- L'image est **uploadée vers Firebase Storage** (pas stockée localement)
- L'URL retournée est automatiquement **sauvegardée dans la base de données** (colonne `image_url`)
- L'image est automatiquement convertie en PNG
- Le nom du fichier sera `{userId}.png` dans le dossier `profiles/`
- Seul l'utilisateur propriétaire peut modifier sa propre image
- Le champ de formulaire doit s'appeler exactement **`image`** (pas `file`, `photo`, etc.)

---

### 🏠 **Rooms (Salles de jeu)**

#### `GET /api/rooms/:id`

Récupérer les détails d'une room avec ses images.

**Headers :** `Authorization: Bearer <token>`

**Réponse :**

```json
{
  "id": 1,
  "name": "ma-room",
  "hostcharacterid": 5,
  "guestcharacterid": 12,
  "images": [
    {
      "id": 1,
      "url": "https://example.com/character1.jpg",
      "category": "animals"
    }
  ]
}
```

#### `GET /api/rooms/:id/images`

Récupérer uniquement les images d'une room.

**Headers :** `Authorization: Bearer <token>`

**Réponse :**

```json
{
  "images": [
    {
      "id": 1,
      "url": "https://example.com/character1.jpg",
      "category": "animals"
    }
  ]
}
```

---

### 🖼️ **Images**

#### `GET /api/images/categories`

Récupérer toutes les catégories d'images disponibles.

**Headers :** `Authorization: Bearer <token>`

**Réponse :**

```json
["animals", "celebrities", "cartoons"]
```

---

## 🔌 WebSocket Events (Socket.IO)

### 📡 **Connexion**

```javascript
const socket = io('http://localhost:8080');
```

### 🎯 **Événements à émettre (Client → Serveur)**

#### `create` - Créer une room

```javascript
socket.emit('create', {
  name: 'ma-room', // string - nom unique de la room
  userId: '123', // string - ID de l'utilisateur créateur
  category: 'animals', // string - catégorie d'images
});
```

#### `join` - Rejoindre une room

```javascript
socket.emit('join', {
  name: 'ma-room', // string - nom de la room
  userId: '456', // string - ID de l'utilisateur
});
```

#### `start` - Démarrer le jeu

```javascript
socket.emit('start', {
  name: 'ma-room', // string - nom de la room
});
```

#### `choose` - Choisir son personnage

```javascript
socket.emit('choose', {
  id: 1, // number - ID de la room
  name: 'ma-room', // string - nom de la room
  player: 'host', // string - "host" ou "guest"
  characterId: 5, // number - ID du personnage choisi
});
```

#### `question` - Poser une question

```javascript
socket.emit('question', {
  name: 'ma-room', // string - nom de la room
  question: 'Est-ce que ton personnage porte des lunettes ?',
});
```

#### `answer` - Répondre à une question

```javascript
socket.emit('answer', {
  name: 'ma-room', // string - nom de la room
  answer: 'Oui', // string - "Oui" ou "Non"
});
```

#### `change turn` - Changer de tour

```javascript
socket.emit('change turn', {
  name: 'ma-room', // string - nom de la room
  player: 'guest', // string - joueur qui prend le tour
});
```

#### `select` - Sélectionner le personnage adverse (deviner)

```javascript
socket.emit('select', {
  name: 'ma-room', // string - nom de la room
  characterId: 12, // number - ID du personnage deviné
  player: 'host', // string - joueur qui devine
});
```

#### `lost lifes` - Signaler qu'un joueur a perdu toutes ses vies

```javascript
socket.emit('lost lifes', {
  name: 'ma-room', // string - nom de la room
  player: 'host', // string - joueur qui a perdu
});
```

#### `ask rematch` - Demander un rematch

```javascript
socket.emit('ask rematch', {
  name: 'ma-room', // string - nom de la room
  player: 'host', // string - joueur qui demande
});
```

#### `rematch` - Créer une nouvelle room pour le rematch

```javascript
socket.emit('rematch', {
  oldRoomName: 'ma-room', // string - nom de l'ancienne room
  newRoomName: 'ma-room-2', // string - nom de la nouvelle room
  category: 'animals', // string - catégorie pour la nouvelle room
  hostId: '123', // string - ID de l'host
});
```

#### `join rematch` - Rejoindre une room de rematch

```javascript
socket.emit('join rematch', {
  newRoomName: 'ma-room-2', // string - nom de la nouvelle room
  guestId: '456', // string - ID du guest
});
```

#### `quit` - Quitter la room

```javascript
socket.emit('quit', {
  id: 1, // number - ID de la room
  name: 'ma-room', // string - nom de la room
  userId: '123', // string - ID de l'utilisateur
});
```

---

### 👂 **Événements à écouter (Serveur → Client)**

#### Événements de room

```javascript
// Room créée avec succès
socket.on('roomCreated', (data) => {
  // data: { room: "ma-room", roomId: 1, images: [...] }
});

// Room créée (confirmation pour le créateur)
socket.on('room created', (data) => {
  // data: { roomId: 1, roomName: "ma-room" }
});

// Utilisateur a rejoint la room
socket.on('joined', (data) => {
  // data: {
  //   roomId: 1,
  //   roomName: "ma-room",
  //   hostId: 123,
  //   hostName: "Alice",
  //   category: "animals",
  //   images: [
  //     { id: 1, url: "https://example.com/character1.jpg", category: "animals" },
  //     { id: 2, url: "https://example.com/character2.jpg", category: "animals" }
  //   ]
  // }
});

// Nouvel invité dans la room
socket.on('guest joined', (data) => {
  // data: { id: 1, userId: "456", socketId: "abc123" }
});
```

#### Événements de jeu

```javascript
// Jeu démarré
socket.on('game started', (data) => {
  // data: { roomName: "ma-room" }
});

// Personnage choisi
socket.on('character chosen', (data) => {
  // data: { player: "host", characterId: 5 }
});

// Les deux joueurs ont choisi, le plateau est prêt
socket.on('go board', (data) => {
  // data: { roomName: "ma-room" }
});
```

#### Événements de questions/réponses

```javascript
// Question reçue
socket.on('ask', (data) => {
  // data: {
  //   question: "Est-ce que...",
  //   player: "host",
  //   name: "ma-room"
  // }
});

// Réponse reçue
socket.on('answer', (data) => {
  // data: {
  //   answer: "Oui",
  //   player: "guest",
  //   name: "ma-room"
  // }
});
```

#### Événements de tour

```javascript
// C'est le tour d'un joueur
socket.on('start turn', (data) => {
  // data: { turn: "guest" }
});
```

#### Événements de victoire

```javascript
// Résultat de la sélection de personnage
socket.on('select result', (data) => {
  // data: {
  //   player: "host", // ou "guest"
  //   right: true, // true si correct, false si incorrect
  //   hostCharacterId: 5, // ID du personnage de l'hôte
  //   guestCharacterId: 12 // ID du personnage de l'invité
  // }

  if (data.right) {
    console.log(`${data.player} a gagné !`);
    console.log(`Personnage hôte: ${data.hostCharacterId}`);
    console.log(`Personnage invité: ${data.guestCharacterId}`);
  } else {
    console.log(`${data.player} a perdu...`);
  }
});

// Un joueur a perdu toutes ses vies
socket.on('player lost all lifes', (data) => {
  // data: { player: "host" }
});
```

#### Événements de rematch

```javascript
// Demande de rematch reçue
socket.on('ask play again', (data) => {
  // data: { player: "host" }
});

// Les deux joueurs veulent rejouer
socket.on('rematch can start', (data) => {
  // data: { event: "play_again" }
});

// Invitation à rejoindre une nouvelle room
socket.on('rematch invitation', (data) => {
  // data: {
  //   newRoomName: "ma-room-2",
  //   category: "animals",
  //   hostId: "123",
  //   roomId: 2
  // }
});

// Guest a rejoint la room de rematch
socket.on('guest joined rematch', (data) => {
  // data: {
  //   guestId: "456",
  //   roomName: "ma-room-2"
  // }
});
```

#### Événements de déconnexion

```javascript
// Un joueur s'est déconnecté
socket.on('playerDisconnected', (data) => {
  // data: {
  //   message: "Un joueur s'est déconnecté. La partie est terminée.",
  //   timestamp: "2024-01-15T10:30:00.000Z"
  // }

  // Afficher un message à l'utilisateur
  showNotification(data.message);

  // Rediriger vers le menu principal
  redirectToMainMenu();
});

// Guest a quitté avant le début du jeu
socket.on('guestLeftBeforeStart', (data) => {
  // data: {
  //   roomId: 1,
  //   roomName: "ma-room"
  // }
});
```

#### Événements de quit

```javascript
// Un joueur a quitté la room
socket.on('quit', (data) => {
  // data: { player: "123" }
});

// Confirmation de sortie de room
socket.on('room left', (data) => {
  // data: { roomId: 1 }
});
```

#### Événements d'erreur

```javascript
// Erreur générale
socket.on('error', (data) => {
  // data: { message: "Description de l'erreur" }
});

// Événements de connexion
socket.on('connect', () => {
  console.log('Connecté au serveur');
});

socket.on('disconnect', (reason) => {
  console.log('Déconnecté:', reason);
});
```

---

## 🔌 Gestion des déconnexions et quits

### 🚫 **Détection automatique des déconnexions**

Le serveur détecte automatiquement les déconnexions d'utilisateurs dans les cas suivants :

- Fermeture de page/navigateur
- Perte de connexion réseau
- Fermeture de l'application
- Déconnexion manuelle

### 📡 **Notification de l'autre joueur**

Quand un utilisateur se déconnecte, l'autre joueur reçoit automatiquement l'événement `playerDisconnected` :

```javascript
socket.on('playerDisconnected', (data) => {
  console.log("L'autre joueur s'est déconnecté:", data);

  // Afficher une notification
  showNotification(data.message);

  // Actions recommandées :
  // - Afficher un message d'erreur
  // - Rediriger vers le menu principal
  // - Nettoyer l'état du jeu
  // - Permettre de créer/rejoindre une nouvelle room
});
```

### 🔄 **Gestion des quits avant le début du jeu**

Si un joueur quitte avant que le jeu ne commence :

```javascript
// Guest a quitté avant le début
socket.on('guestLeftBeforeStart', (data) => {
  // data: { roomId: 1, roomName: "ma-room" }

  // La room reste ouverte pour un nouveau guest
  showMessage("L'invité a quitté. La room reste ouverte.");
  // L'host peut attendre un nouveau guest
});
```

### 🧹 **Nettoyage automatique**

Le serveur effectue automatiquement :

1. **Suppression de la room** de la base de données (si partie démarrée)
2. **Réouverture de la room** (si quit avant le début)
3. **Suppression des images** associées à la room (si suppression)
4. **Logs détaillés** pour le debugging

### 💡 **Bonnes pratiques côté client**

```javascript
// Écouter les déconnexions
socket.on('playerDisconnected', (data) => {
  // 1. Afficher un message informatif
  alert("L'autre joueur s'est déconnecté.");

  // 2. Nettoyer l'état du jeu
  resetGameState();

  // 3. Rediriger vers le menu
  navigateToMainMenu();

  // 4. Proposer de créer une nouvelle room
  showCreateRoomOption();
});

// Gérer les quits avant le début
socket.on('guestLeftBeforeStart', (data) => {
  showMessage("L'invité a quitté. Vous pouvez attendre un nouveau joueur.");
  // L'host reste dans la room
});

// Gérer sa propre déconnexion
socket.on('disconnect', (reason) => {
  console.log('Vous vous êtes déconnecté:', reason);
  // Nettoyer l'état local
  clearLocalGameState();
});
```

---

## 🎮 Flow du jeu

### 1. **Authentification**

```javascript
// S'inscrire
fetch('/register', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});

// Se connecter
const response = await fetch('/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});
const { accessToken } = await response.json();
```

### 2. **Upload d'image de profil (optionnel)**

```javascript
// Upload d'une image de profil
const formData = new FormData();
formData.append('image', fileInput.files[0]); // Le champ DOIT s'appeler 'image'

const uploadResponse = await fetch(`/api/users/${userId}/images`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
  body: formData,
});

const uploadResult = await uploadResponse.json();
console.log('Image uploadée:', uploadResult.imageUrl);
// L'URL est automatiquement sauvegardée dans la base de données

// Récupérer les infos de l'utilisateur avec l'URL de l'image
const userResponse = await fetch(`/api/users/${userId}`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const userData = await userResponse.json();
console.log('Image URL depuis la BDD:', userData.image_url);
```

### 3. **Connexion WebSocket**

```javascript
const socket = io('http://localhost:8080');
```

### 4. **Créer/Rejoindre une room**

```javascript
// Hôte crée la room
socket.emit('create', { name: 'room1', userId: '123', category: 'animals' });

// Invité rejoint
socket.emit('join', { name: 'room1', userId: '456' });

// Écouter la confirmation de jointure avec les images
socket.on('joined', (data) => {
  console.log('Rejoint la room:', data.roomName);
  console.log('Catégorie:', data.category);
  console.log('Images disponibles:', data.images.length);
  // data.images contient maintenant toutes les images de la catégorie
});
```

### 5. **Choisir les personnages**

```javascript
// Chaque joueur choisit
socket.emit('choose', { id: 1, name: 'room1', player: 'host', characterId: 5 });
```

### 6. **Démarrer le jeu**

```javascript
socket.emit('start', { name: 'room1' });
```

### 7. **Jouer**

```javascript
// Poser des questions
socket.emit('question', { name: 'room1', question: 'A-t-il des cheveux ?' });

// Répondre
socket.emit('answer', { name: 'room1', answer: 'Oui' });

// Changer de tour
socket.emit('change turn', { name: 'room1', player: 'guest' });

// Deviner le personnage
socket.emit('select', { name: 'room1', characterId: 12, player: 'host' });

// Écouter le résultat avec les Character IDs
socket.on('select result', (data) => {
  console.log('Résultat:', data);
  // data contient maintenant hostCharacterId et guestCharacterId
});
```

### 8. **Gérer les déconnexions et quits**

```javascript
// Écouter les déconnexions d'autres joueurs
socket.on('playerDisconnected', (data) => {
  alert("L'autre joueur s'est déconnecté.");
  // Rediriger vers le menu principal
  window.location.href = '/menu';
});

// Gérer les quits avant le début
socket.on('guestLeftBeforeStart', (data) => {
  showMessage("L'invité a quitté. La room reste ouverte.");
  // L'host peut attendre un nouveau guest
});

// Gérer sa propre déconnexion
socket.on('disconnect', (reason) => {
  console.log('Déconnecté:', reason);
  // Nettoyer l'état local
});
```

### 9. **Système de rematch**

```javascript
// Demander un rematch
socket.emit('ask rematch', { name: 'ma-room', player: 'host' });

// Écouter la demande de rematch
socket.on('ask play again', (data) => {
  // Afficher un bouton "Accepter rematch"
  showRematchDialog(data.player);
});

// Les deux joueurs veulent rejouer
socket.on('rematch can start', (data) => {
  // Afficher l'interface de création de nouvelle room
  showRematchInterface();
});

// Créer une nouvelle room pour le rematch
socket.emit('rematch', {
  oldRoomName: 'ma-room',
  newRoomName: 'ma-room-2',
  category: 'animals',
  hostId: '123',
});

// Rejoindre la room de rematch
socket.emit('join rematch', {
  newRoomName: 'ma-room-2',
  guestId: '456',
});
```

---

## 🛠️ Codes d'erreur HTTP

- **200** : Succès
- **201** : Créé avec succès
- **400** : Données invalides
- **401** : Non authentifié
- **403** : Non autorisé
- **404** : Ressource non trouvée
- **500** : Erreur serveur

---

## 🧪 Tests avec Jest

Pour tester l'API, utilisez les fichiers de test fournis :

```bash
# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:cov
```

---

## 📝 Notes importantes

1. **CORS** : Activé pour tous les domaines en développement
2. **Validation** : Toutes les données sont validées avec class-validator
3. **WebSocket** : Utilise Socket.IO v4.5.1
4. **Base de données** : Les migrations doivent être exécutées avant utilisation
5. **JWT** : Les tokens n'expirent plus (configuration modifiée)
6. **Gestion des déconnexions** : Le serveur détecte automatiquement les déconnexions et notifie l'autre joueur
7. **Nettoyage automatique** : Les rooms sont automatiquement supprimées quand un joueur se déconnecte
8. **Gestion des quits** : Si un guest quitte avant le début, la room reste ouverte
9. **Système de rematch** : Permet aux joueurs de rejouer avec une nouvelle room
10. **Score et niveaux** : Système de points et de progression intégré
11. **Firebase Storage** : Configuration requise pour l'upload d'images de profil
12. **Migration BDD** : Exécutez la migration pour ajouter la colonne `image_url` à la table `user` :
    ```sql
    ALTER TABLE "user" ADD COLUMN "image_url" VARCHAR NULL;
    ```
13. **Système de tracking** : Plus de `connectedUsers` - utilisation des rooms WebSocket natives

---

## 🎯 **Résumé des événements WebSocket**

### **Événements émis par le client (13 événements) :**

1. `create` - Créer une room
2. `join` - Rejoindre une room
3. `start` - Démarrer le jeu
4. `choose` - Choisir son personnage
5. `question` - Poser une question
6. `answer` - Répondre à une question
7. `change turn` - Changer de tour
8. `select` - Deviner le personnage adverse
9. `lost lifes` - Signaler qu'un joueur a perdu toutes ses vies
10. `ask rematch` - Demander un rematch
11. `rematch` - Créer une nouvelle room pour le rematch
12. `join rematch` - Rejoindre une room de rematch
13. `quit` - Quitter la room

### **Événements reçus par le client (15 événements) :**

1. `roomCreated` - Room créée avec succès
2. `room created` - Confirmation de création
3. `joined` - Utilisateur a rejoint la room
4. `guest joined` - Nouvel invité dans la room
5. `game started` - Jeu démarré
6. `character chosen` - Personnage choisi
7. `go board` - Plateau prêt (les deux joueurs ont choisi)
8. `ask` - Question reçue
9. `answer` - Réponse reçue
10. `start turn` - C'est le tour d'un joueur
11. `select result` - Résultat de la devinette
12. `player lost all lifes` - Un joueur a perdu toutes ses vies
13. `ask play again` - Demande de rematch reçue
14. `rematch can start` - Les deux joueurs veulent rejouer
15. `rematch invitation` - Invitation à rejoindre une nouvelle room
16. `guest joined rematch` - Guest a rejoint la room de rematch
17. `playerDisconnected` - Un joueur s'est déconnecté
18. `guestLeftBeforeStart` - Guest a quitté avant le début
19. `quit` - Un joueur a quitté la room
20. `room left` - Confirmation de sortie de room
21. `error` - Erreur générale

---

## 🔥 Configuration Firebase

### 📋 **Variables d'environnement requises**

Ajoutez ces variables dans votre fichier `.env` :

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_service_account_email@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

### 🛠️ **Configuration Firebase Storage**

1. **Créer un projet Firebase** sur [Firebase Console](https://console.firebase.google.com/)
2. **Activer Storage** dans votre projet
3. **Créer un compte de service** :
   - Aller dans "Paramètres du projet" > "Comptes de service"
   - Cliquer sur "Générer une nouvelle clé privée"
   - Télécharger le fichier JSON et extraire les valeurs

### 📁 **Structure des fichiers**

Les images de profil sont stockées dans :

```
gs://your-bucket/profiles/
├── 1.png    (Image de l'utilisateur ID 1)
├── 2.png    (Image de l'utilisateur ID 2)
└── ...
```

### 🔒 **Sécurité**

- Les fichiers sont automatiquement rendus publics
- Seul l'utilisateur propriétaire peut modifier sa propre image
- Validation des types de fichiers (images uniquement)
- Limite de taille : 5MB maximum

### 🧪 **Tester l'upload avec Postman**

1. **Créer une requête POST** : `http://localhost:8080/api/users/{userId}/images`
2. **Headers** :
   - `Authorization: Bearer YOUR_JWT_TOKEN`
3. **Body** :
   - Sélectionner **`form-data`**
   - Ajouter un champ avec :
     - **Key** : `image` (type: File) ⚠️ Le nom doit être exactement "image"
     - **Value** : Sélectionner votre fichier image
4. **Send**

**Erreur commune** : Si vous recevez `"Unexpected field"`, vérifiez que le nom du champ est bien **`image`** et non `file`, `photo`, ou autre.

---

## 🔗 Liens utiles

- [Documentation NestJS](https://nestjs.com/)
- [Documentation Socket.IO](https://socket.io/docs/)
- [Documentation TypeORM](https://typeorm.io/)

---

_Documentation générée pour le projet "Qui est-ce ?" - Version 1.0_
