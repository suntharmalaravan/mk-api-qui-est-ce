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
  "score": 150
}
```

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

// Utilisateur a rejoint la room
socket.on('joined', (data) => {
  // data: { roomId: 1, roomName: "ma-room" }
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

// Signal de démarrage reçu
socket.on('start the game', (data) => {
  // data: {}
});

// Personnage choisi
socket.on('character chosen', (data) => {
  // data: { player: "host", characterId: 5 }
});

// Un joueur a choisi son personnage
socket.on('player has chosen his character', (data) => {
  // data: { player: "host" }
});
```

#### Événements de questions/réponses

```javascript
// Question reçue
socket.on('ask', (data) => {
  // data: { question: "Est-ce que..." }
});

// Question envoyée (confirmation)
socket.on('question sent', (data) => {
  // data: { question: "Est-ce que..." }
});

// Réponse reçue
socket.on('answer', (data) => {
  // data: { answer: "Oui" }
});

// Réponse envoyée (confirmation)
socket.on('answer sent', (data) => {
  // data: { answer: "Oui" }
});
```

#### Événements de tour

```javascript
// C'est le tour d'un joueur
socket.on('turn start', (data) => {
  // data: { player: "guest" }
});

// Tour changé (confirmation)
socket.on('turn changed', (data) => {
  // data: { player: "guest" }
});
```

#### Événements de victoire

```javascript
// L'hôte a gagné
socket.on('host won', (data) => {
  // data: { winner: "host", ... }
});

// L'hôte a perdu
socket.on('host lost', (data) => {
  // data: { loser: "host", ... }
});

// L'invité a gagné
socket.on('guest won', (data) => {
  // data: { winner: "guest", ... }
});

// L'invité a perdu
socket.on('guest lost', (data) => {
  // data: { loser: "guest", ... }
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

### 2. **Connexion WebSocket**

```javascript
const socket = io('http://localhost:8080');
```

### 3. **Créer/Rejoindre une room**

```javascript
// Hôte crée la room
socket.emit('create', { name: 'room1', userId: '123', category: 'animals' });

// Invité rejoint
socket.emit('join', { name: 'room1', userId: '456' });
```

### 4. **Choisir les personnages**

```javascript
// Chaque joueur choisit
socket.emit('choose', { id: 1, name: 'room1', player: 'host', characterId: 5 });
```

### 5. **Démarrer le jeu**

```javascript
socket.emit('start', { name: 'room1' });
```

### 6. **Jouer**

```javascript
// Poser des questions
socket.emit('question', { name: 'room1', question: 'A-t-il des cheveux ?' });

// Répondre
socket.emit('answer', { name: 'room1', answer: 'Oui' });

// Changer de tour
socket.emit('change turn', { name: 'room1', player: 'guest' });

// Deviner le personnage
socket.emit('select', { name: 'room1', characterId: 12, player: 'host' });
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
5. **JWT** : Les tokens expirent selon la configuration (par défaut 24h)

---

## 🔗 Liens utiles

- [Documentation NestJS](https://nestjs.com/)
- [Documentation Socket.IO](https://socket.io/docs/)
- [Documentation TypeORM](https://typeorm.io/)

---

_Documentation générée pour le projet "Qui est-ce ?" - Version 1.0_
