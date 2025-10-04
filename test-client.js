const io = require('socket.io-client');

console.log('🚀 Démarrage du client de test...');

const socket = io('http://localhost:8080', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ Connecté ! Socket ID:', socket.id);

  // Test create room après 1 seconde
  setTimeout(() => {
    console.log('📤 Envoi événement create...');
    socket.emit('create', {
      name: 'test-node-client',
      userId: 'node-user-123',
      category: 'animals',
    });
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Déconnecté:', reason);
});

socket.on('roomCreated', (data) => {
  console.log('🎯 Room créée:', data);
  process.exit(0);
});

socket.on('error', (data) => {
  console.error('⚠️ Erreur:', data);
  process.exit(1);
});

// Timeout de sécurité
setTimeout(() => {
  console.log('⏰ Timeout - Fermeture du client');
  process.exit(1);
}, 10000);
