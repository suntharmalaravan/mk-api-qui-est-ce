import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
import { ImageService } from 'src/image/image.service';
import { RoomImageService } from 'src/room-image/room-image.service';
import { UserService } from 'src/user/user.service';
@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})
export class RoomGateway {
  @WebSocketServer() wss: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly imageService: ImageService,
    private readonly roomImageService: RoomImageService,
    private readonly userService: UserService,
  ) {}

  // Événements de connexion/déconnexion pour debug
  handleConnection(client: Socket) {
    console.log('🔌 Nouvelle connexion WebSocket:', {
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    console.log('🔌 Déconnexion WebSocket:', {
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    // Trouver la room de l'utilisateur déconnecté et notifier l'autre joueur
    this.handleUserDisconnection(client.id);
  }

  /**
   * Gère la déconnexion d'un utilisateur et notifie l'autre joueur
   */
  private async handleUserDisconnection(socketId: string) {
    try {
      // Récupérer toutes les rooms de la DB pour trouver celle du joueur déconnecté
      const rooms = await this.roomService.findAll();

      for (const room of rooms) {
        // Vérifier si le socket déconnecté était dans cette room
        const roomSockets = await this.wss.in(room.name).fetchSockets();
        const isSocketInRoom = roomSockets.some((s) => s.id === socketId);

        if (isSocketInRoom) {
          console.log('🚫 Utilisateur déconnecté détecté:', {
            socketId,
            roomName: room.name,
            timestamp: new Date().toISOString(),
          });

          // Notifier tous les joueurs de la room
          await this.notifyUserDisconnection(room.name);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la gestion de la déconnexion:', error);
    }
  }

  /**
   * Notifie l'autre joueur de la déconnexion
   */
  private async notifyUserDisconnection(roomName: string) {
    try {
      console.log(
        '📡 Notification de déconnexion envoyée à tous les joueurs:',
        {
          roomName,
          timestamp: new Date().toISOString(),
        },
      );

      // Gestion de la room selon son état
      const room = await this.roomService.findByName(roomName);
      if (room) {
        const gameStarted =
          room.hostcharacterid !== null || room.guestcharacterid !== null;

        if (!gameStarted) {
          console.log('🔁 Room rouverte car déconnexion avant le début:', {
            roomId: room.id,
            roomName,
          });
          await this.roomService.reopenRoomAfterGuestLeaves(roomName);

          // Notifier tous les joueurs restants
          this.wss.to(roomName).emit('guestLeftBeforeStart', {
            roomId: room.id,
            roomName,
          });
        } else {
          console.log('🗑️ Suppression de la room suite à la déconnexion:', {
            roomId: room.id,
            roomName,
            reason: 'user_disconnected',
          });
          // Notifier tous les joueurs de la room
          this.wss.to(roomName).emit('playerDisconnected', {
            message: "Un joueur s'est déconnecté. La partie est terminée.",
            timestamp: new Date().toISOString(),
          });
          await this.roomImageService.removeRoomImage(room.id);
          await this.roomService.remove(room.id);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la notification de déconnexion:', error);
    }
  }

  /**
   * Crée une room avec un host (méthode réutilisable)
   */
  private async createRoomWithHost(
    roomName: string,
    userId: number,
    category: string,
  ) {
    const room = await this.roomService.create({
      name: roomName,
      status: 'open',
      hostplayerid: userId,
      guestplayerid: null,
      hostcharacterid: null,
      guestcharacterid: null,
      category: category,
    });
    return room;
  }

  /**
   * Ajoute un guest à une room (méthode réutilisable)
   */
  private async addGuestToRoom(roomName: string, userId: number) {
    const joinedRoom = await this.roomService.addGuest(roomName, {
      guestplayerid: userId,
    });
    return joinedRoom;
  }

  /**
   * Notifie la création d'une room au host
   */
  private async notifyRoomCreation(socket: Socket, room: any, userId: number) {
    socket.emit('room created', {
      roomId: room.id,
      roomName: room.name,
      hostId: userId,
      category: room.category,
    });
  }

  /**
   * Notifie qu'un guest a rejoint la room
   */
  private async notifyGuestJoined(socket: Socket, room: any) {
    // Récupérer l'identité de l'host
    const host = await this.userService.findOne(
      parseInt(room.hostplayerid.toString()),
    );
    const hostName = host ? host.username : `User-${room.hostplayerid}`;

    // Récupérer les images de la catégorie de la room
    const images = await this.imageService.getUrlsByCategory(room.category);
    socket.to(room.name).emit('joined', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      category: room.category,
      images: images,
    });
    socket.emit('joined', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      category: room.category,
      images: images,
    });
  }
  @SubscribeMessage('create')
  async createRoom(socket: Socket, data: any) {
    console.log('🏠 Event: create room', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validation des données requises
      if (!data.name || !data.userId || !data.category) {
        console.log('❌ Validation failed for create room:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            userId: !data.userId,
            category: !data.category,
          },
        });
        socket.emit('error', {
          message:
            'Missing required data: name, userId, and category are required',
        });
        return;
      }
      // Vérifier si la room existe déjà
      const existingRoom = await this.roomService.findByName(data.name);
      if (existingRoom) {
        console.log('⚠️ Room already exists:', {
          socketId: socket.id,
          roomName: data.name,
          existingRoomId: existingRoom.id,
        });
        socket.emit('error', { message: 'Room with this name already exists' });
        return;
      }

      console.log('📝 Creating new room in database...');
      const room = await this.roomService.create({
        name: data.name,
        status: 'open',
        hostplayerid: data.userId,
        guestplayerid: null,
        hostcharacterid: null,
        guestcharacterid: null,
        category: data.category,
      });
      console.log('✅ Room created successfully:', {
        socketId: socket.id,
        roomId: room.id,
        roomName: room.name,
        hostId: room.hostplayerid,
        category: room.category,
      });

      // Récupérer les images de la catégorie
      console.log('🖼️ Fetching images for category:', data.category);
      const images = await this.imageService.getUrlsByCategory(data.category);
      console.log('📸 Images retrieved:', {
        category: data.category,
        imageCount: images.length,
        firstImage: images[0] || 'No images found',
      });

      // Le créateur rejoint automatiquement sa propre room
      socket.join(data.name);
      console.log('🔗 Socket joined room:', {
        socketId: socket.id,
        roomName: data.name,
      });

      console.log('👤 Host créé la room:', {
        roomName: data.name,
        socketId: socket.id,
        userId: data.userId,
      });

      // Notifier la création de la room
      const roomData = { room: data.name, roomId: room.id, images: images };
      console.log('📡 Emitting roomCreated event:', {
        socketId: socket.id,
        roomData: roomData,
      });
      socket.to(data.name).emit('roomCreated', roomData);
      socket.emit('roomCreated', roomData);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  }

  @SubscribeMessage('join')
  async joinRoom(socket: Socket, data: any) {
    console.log('🚪 Event: join room', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validation des données requises
      if (!data.name || !data.userId) {
        console.log('❌ Validation failed for join room:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            userId: !data.userId,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and userId are required',
        });
        return;
      }

      // Vérifier et rejoindre la room en base de données d'abord
      console.log('📝 Adding guest to room in database...');
      const joinedRoom = await this.roomService.addGuest(data.name, {
        guestplayerid: data.userId,
      });
      console.log('✅ Guest added to room successfully:', {
        socketId: socket.id,
        roomId: joinedRoom.id,
        roomName: joinedRoom.name,
        guestId: data.userId,
      });

      // Si succès, rejoindre la room WebSocket
      socket.join(data.name);
      console.log('🔗 Socket joined room:', {
        socketId: socket.id,
        roomName: data.name,
      });

      console.log('👤 Guest rejoint la room:', {
        roomName: data.name,
        socketId: socket.id,
        userId: data.userId,
      });

      // Récupérer le username du joueur
      console.log('👤 Fetching user information for guest...');
      const user = await this.userService.findOne(parseInt(data.userId));
      const username = user ? user.username : `User-${data.userId}`;
      console.log('👤 User information retrieved:', {
        socketId: socket.id,
        userId: data.userId,
        username: username,
        userExists: !!user,
      });

      // Notifier les autres clients dans la room
      const guestJoinedData = {
        id: joinedRoom.id,
        userId: data.userId,
        username: username,
        socketId: socket.id,
      };
      console.log('📡 Emitting guest joined event:', {
        socketId: socket.id,
        roomName: data.name,
        guestData: guestJoinedData,
      });
      socket.to(data.name).emit('guest joined', guestJoinedData);

      // Récupérer l'identité de l'host
      console.log('👤 Fetching host information...', joinedRoom);
      const host = await this.userService.findOne(
        parseInt(joinedRoom.hostplayerid.toString()),
      );
      const hostName = host ? host.username : `User-${joinedRoom.hostplayerid}`;
      console.log('👤 Host information retrieved:', {
        socketId: socket.id,
        hostId: joinedRoom.hostplayerid,
        hostName: hostName,
        hostExists: !!host,
      });

      // Récupérer les images de la catégorie de la room
      console.log('🖼️ Fetching images for room category:', joinedRoom.category);
      const images = await this.imageService.getUrlsByCategory(
        joinedRoom.category,
      );
      console.log('📸 Images retrieved for joined room:', {
        category: joinedRoom.category,
        imageCount: images.length,
        firstImage: images[0] || 'No images found',
      });

      // Confirmer au client qui rejoint
      const hostJoinedData = {
        roomId: joinedRoom.id,
        roomName: data.name,
        hostId: joinedRoom.hostplayerid,
        hostName: hostName,
        category: joinedRoom.category,
        images: images,
      };
      console.log('📡 Emitting joined confirmation:', {
        socketId: socket.id,
        hostJoinedData: hostJoinedData,
      });
      socket.emit('joined', hostJoinedData);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('start')
  async startGame(socket: Socket, data: any) {
    console.log('🚀 Event: start game', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.name) {
        console.log('❌ Validation failed for start game:', {
          socketId: socket.id,
          missingFields: { name: !data.name },
        });
        socket.emit('error', { message: 'Room name is required' });
        return;
      }

      // Récupérer les informations de la room
      console.log('🔍 Looking for room:', data.name);
      const room = await this.roomService.findByName(data.name);
      if (!room) {
        console.log('⚠️ Room not found:', {
          socketId: socket.id,
          roomName: data.name,
        });
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      console.log('✅ Room found:', {
        socketId: socket.id,
        roomId: room.id,
        roomName: room.name,
        category: room.category,
      });

      // Récupérer les images de la catégorie de la room
      console.log('🖼️ Fetching images for room category:', room.category);
      const images = await this.imageService.getUrlsByCategory(room.category);
      console.log('📸 Images retrieved for game:', {
        category: room.category,
        imageCount: images.length,
        firstImage: images[0] || 'No images found',
      });

      // Envoyer les données avec la catégorie et les images
      const gameData = {
        roomName: data.name,
        category: room.category,
        images: images,
      };
      console.log('📡 Emitting game started event:', {
        socketId: socket.id,
        roomName: data.name,
        gameData: gameData,
      });
      socket.to(data.name).emit('game started', gameData);
      socket.emit('game started', gameData);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  }

  @SubscribeMessage('question')
  async askQuestion(socket: Socket, data: any) {
    console.log('❓ Event: ask question', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.name || !data.player || !data.question) {
        console.log('❌ Validation failed for ask question:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            question: !data.question,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and question are required',
        });
        return;
      }

      console.log('📡 Emitting ask question event:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
        question: data.question,
      });
      socket.to(data.name).emit('ask', {
        question: data.question,
        player: data.player,
        name: data.name,
      });
      socket.emit('ask', {
        question: data.question,
        player: data.player,
        name: data.name,
      });
    } catch (error) {
      console.error('Error asking question:', error);
      socket.emit('error', { message: 'Failed to ask question' });
    }
  }

  @SubscribeMessage('answer')
  async answerQuestion(socket: Socket, data: any) {
    console.log('💬 Event: answer question', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.name || !data.answer || !data.player) {
        console.log('❌ Validation failed for answer question:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            answer: !data.answer,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and answer are required',
        });
        return;
      }

      console.log('📡 Emitting answer event:', {
        socketId: socket.id,
        roomName: data.name,
        answer: data.answer,
      });
      socket.to(data.name).emit('answer', {
        answer: data.answer,
        player: data.player,
        name: data.name,
      });
      socket.emit('answer', {
        answer: data.answer,
        player: data.player,
        name: data.name,
      });
    } catch (error) {
      console.error('Error answering question:', error);
      socket.emit('error', { message: 'Failed to answer question' });
    }
  }

  @SubscribeMessage('choose')
  async chooseCharacter(socket: Socket, data: any) {
    console.log('🎭 Event: choose character', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.name || !data.player || !data.characterId) {
        console.log('❌ Validation failed for choose character:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
            characterId: !data.characterId,
          },
        });
        socket.emit('error', {
          message:
            'Missing required data: name, player, and characterId are required',
        });
        return;
      }

      console.log('📝 Saving character choice in database...');
      await this.roomService.chooseCharacter(
        data.name,
        data.player,
        data.characterId,
      );
      console.log('✅ Character choice saved:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
        characterId: data.characterId,
      });

      // Vérifier si les deux joueurs ont choisi leurs personnages
      console.log(
        '🔍 Checking if both players have chosen their characters...',
      );
      const room = await this.roomService.findByName(data.name);
      const bothPlayersChosen = room.hostcharacterid && room.guestcharacterid;

      console.log('🎭 Character selection status:', {
        socketId: socket.id,
        roomName: data.name,
        hostCharacterId: room.hostcharacterid,
        guestCharacterId: room.guestcharacterid,
        bothPlayersChosen: bothPlayersChosen,
      });

      if (bothPlayersChosen) {
        console.log('🎯 Both players have chosen - starting game board!');
        const goBoardData = { turn: 'host' };
        console.log('📡 Emitting go board event:', {
          socketId: socket.id,
          roomName: data.name,
          goBoardData: goBoardData,
        });
        socket.to(data.name).emit('go board', goBoardData);
        socket.emit('go board', goBoardData);
      } else {
        console.log('⏳ Waiting for other player to choose character...');
        console.log('📡 Emitting character choice events:', {
          socketId: socket.id,
          roomName: data.name,
          player: data.player,
          characterId: data.characterId,
        });
        socket.to(data.name).emit('character chosen', {
          player: data.player,
          characterId: data.characterId,
        });
        socket.emit('character chosen', {
          player: data.player,
          characterId: data.characterId,
        });
      }
    } catch (error) {
      console.error('Error choosing character:', error);
      socket.emit('error', { message: 'Failed to choose character' });
    }
  }

  @SubscribeMessage('change turn')
  async changeTurn(socket: Socket, data: any) {
    console.log('🔄 Event: change turn', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.name || !data.player) {
        console.log('❌ Validation failed for change turn:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      console.log('📡 Emitting turn change events:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
      });
      socket.to(data.name).emit('start turn', { turn: data.player });
      socket.emit('start turn', { turn: data.player });
    } catch (error) {
      socket.emit('error', { message: 'Failed to change turn' });
    }
  }

  @SubscribeMessage('select')
  async selectCharacter(socket: Socket, data: any) {
    console.log('🎯 Event: select character', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.name || !data.player || !data.characterId) {
        console.log('❌ Validation failed for select character:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
            characterId: !data.characterId,
          },
        });
        socket.emit('error', {
          message:
            'Missing required data: name, player, and characterId are required',
        });
        return;
      }

      console.log('🔍 Checking character selection result...');
      const character = await this.roomService.selectCharacter(
        data.name,
        data.player,
        data.characterId,
      );

      const gameResult = character ? 'won' : 'lost';
      console.log('🏆 Game result determined:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
        characterId: data.characterId,
        result: gameResult,
        isCorrect: character,
      });

      const eventName = `${data.player} ${gameResult}`;
      console.log('📡 Emitting game result events:', {
        socketId: socket.id,
        roomName: data.name,
        eventName: eventName,
      });

      if (character) {
        // Récupérer les character IDs de la room
        const room = await this.roomService.findByName(data.name);
        const hostCharacterId = room?.hostcharacterid;
        const guestCharacterId = room?.guestcharacterid;

        console.log('🎭 Character IDs récupérés:', {
          socketId: socket.id,
          roomName: data.name,
          hostCharacterId,
          guestCharacterId,
        });

        // Mettre à jour le score du joueur gagnant (+100 points)
        const winnerUserId =
          data.player === 'host' ? room.hostplayerid : room.guestplayerid;
        const winnerUser = await this.userService.findOne(winnerUserId);
        if (winnerUser) {
          const newScore = winnerUser.score + 8;
          await this.userService.updateScore(winnerUserId, newScore);
          console.log('🏆 Score mis à jour:', {
            userId: winnerUserId,
            player: data.player,
            oldScore: winnerUser.score,
            newScore: newScore,
          });
        }

        socket.emit('select result', {
          player: data.player,
          right: true,
          hostCharacterId,
          guestCharacterId,
        });
        socket.to(data.name).emit('select result', {
          player: data.player,
          right: true,
          hostCharacterId,
          guestCharacterId,
        });
      } else {
        socket.emit('select result', { player: data.player, right: false });
        socket
          .to(data.name)
          .emit('select result', { player: data.player, right: false });
      }
    } catch (error) {
      console.error('Error selecting character', error);
      socket.emit('error', { message: 'Failed to select character' });
    }
  }

  @SubscribeMessage('lost lifes')
  async playerLostLifes(socket: Socket, data: any) {
    try {
      if (!data.name || !data.player) {
        console.log('❌ Validation failed for lost lifes:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      // Récupérer la room et attribuer +8 points au gagnant
      const room = await this.roomService.findByName(data.name);
      if (room) {
        // Déterminer qui est le gagnant (l'autre joueur)
        const winnerUserId =
          data.player === 'host' ? room.guestplayerid : room.hostplayerid;

        if (winnerUserId) {
          const winnerUser = await this.userService.findOne(winnerUserId);
          if (winnerUser) {
            // Incrémenter le score de 8 points
            const newScore = winnerUser.score + 8;
            await this.userService.updateScore(winnerUserId, newScore);

            console.log('🎯 Score mis à jour après perte de vies:', {
              loser: data.player,
              winnerId: winnerUserId,
              oldScore: winnerUser.score,
              newScore: newScore,
              pointsGained: 8,
            });
          }
        }
      }

      socket.emit('player lost all lifes', { player: data.player });
      socket
        .to(data.name)
        .emit('player lost all lifes', { player: data.player });
    } catch (error) {
      console.error('Error losing lifes', error);
      socket.emit('error', { message: 'Failed to lose lifes' });
    }
  }

  @SubscribeMessage('ask rematch')
  async askRematch(socket: Socket, data: any) {
    try {
      if (!data.name || !data.player) {
        console.log('❌ Validation failed for ask rematch:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      console.log('🔄 Event: ask rematch', {
        socketId: socket.id,
        data: data,
        timestamp: new Date().toISOString(),
      });

      const roomName = data.name;
      const player = data.player;

      // Récupérer tous les sockets de la room
      const roomSockets = await this.wss.in(roomName).fetchSockets();
      console.log('🔍 Room sockets for rematch:', roomSockets.length);

      // Trouver le socket actuel et l'autre socket
      const currentSocket = roomSockets.find((s) => s.id === socket.id);
      const otherSockets = roomSockets.filter((s) => s.id !== socket.id);

      // Vérifier si l'autre joueur a déjà demandé un rematch
      const otherSocket = otherSockets[0]; // Prendre le premier autre socket
      const hasOtherRequested = otherSocket?.data?.playAgainRequested;

      if (hasOtherRequested) {
        // L'autre joueur a déjà demandé, on peut procéder
        console.log('✅ Les deux joueurs veulent rejouer');

        // Nettoyer les flags
        if (currentSocket) currentSocket.data.playAgainRequested = false;
        if (otherSocket) otherSocket.data.playAgainRequested = false;

        // Émettre l'événement final
        socket.to(roomName).emit('rematch can start', { event: 'play_again' });
        socket.emit('rematch can start', { event: 'play_again' });
      } else {
        // Marquer que ce joueur attend
        if (currentSocket) currentSocket.data.playAgainRequested = true;

        console.log(`⏳ Joueur ${player} attend la réponse de l'autre`);
        socket.to(roomName).emit('ask play again', { player });
        socket.emit('ask play again', { player });
      }
    } catch (error) {
      console.error('Error asking rematch', error);
      socket.emit('error', { message: 'Failed to ask rematch' });
    }
  }

  @SubscribeMessage('rematch')
  async rematch(socket: Socket, data: any) {
    console.log('🔄 Event: rematch', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.newRoomName || !data.category || !data.hostId) {
        console.log('❌ Validation failed for rematch:', {
          socketId: socket.id,
          missingFields: {
            newRoomName: !data.newRoomName,
            category: !data.category,
            hostId: !data.hostId,
          },
        });
        socket.emit('error', {
          message:
            'Missing required data: newRoomName, category, and hostId are required',
        });
        return;
      }

      // 1. Créer la nouvelle room avec le host
      const newRoom = await this.createRoomWithHost(
        data.newRoomName,
        data.hostId,
        data.category,
      );

      // 2. Notifier le host de la création
      await this.notifyRoomCreation(socket, newRoom, data.hostId);

      // 3. Notifier tous les autres joueurs de la room de rejoindre
      socket.to(data.oldRoomName).emit('rematch invitation', {
        newRoomName: data.newRoomName,
        category: data.category,
        hostId: data.hostId,
        roomId: newRoom.id,
      });

      console.log('✅ Rematch room created successfully:', {
        newRoomName: data.newRoomName,
        category: data.category,
        hostId: data.hostId,
      });
    } catch (error) {
      console.error('Error creating rematch room:', error);
      socket.emit('error', { message: 'Failed to create rematch room' });
    }
  }

  @SubscribeMessage('join rematch')
  async joinRematch(socket: Socket, data: any) {
    console.log('🔄 Event: join rematch', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.newRoomName || !data.guestId) {
        socket.emit('error', {
          message:
            'Missing required data: newRoomName and guestId are required',
        });
        return;
      }

      // 1. Ajouter le guest à la nouvelle room
      const joinedRoom = await this.addGuestToRoom(
        data.newRoomName,
        data.guestId,
      );

      // 2. Notifier le guest
      await this.notifyGuestJoined(socket, joinedRoom);

      console.log('✅ Guest joined rematch room successfully:', {
        newRoomName: data.newRoomName,
        guestId: data.guestId,
      });
    } catch (error) {
      console.error('Error joining rematch room:', error);
      socket.emit('error', { message: 'Failed to join rematch room' });
    }
  }

  @SubscribeMessage('quit')
  async quitRoom(socket: Socket, data: any) {
    console.log('🚫 Event: quit room', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!data.id || !data.name || !data.userId) {
        console.log('❌ Validation failed for quit room:', {
          socketId: socket.id,
          missingFields: {
            id: !data.id,
            name: !data.name,
            userId: !data.userId,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: id, name, and userId are required',
        });
        return;
      }

      const room = await this.roomService.findByName(data.name);
      const gameStarted = !!(room?.hostcharacterid || room?.guestcharacterid);

      if (!gameStarted) {
        // Partie pas encore démarrée: rouvrir la room
        await this.roomService.reopenRoomAfterGuestLeaves(data.name);
        console.log('🔁 Room reopened after quit before game start');

        // Notifier tous les autres joueurs
        socket.to(data.name).emit('guestLeftBeforeStart', {
          roomId: room?.id,
          roomName: data.name,
        });

        // Confirmer au joueur qui quitte
        socket.emit('room left', { roomId: room?.id });
        socket.leave(data.name);
        socket.disconnect();
      } else {
        // Partie déjà démarrée: supprimer la room
        console.log('🗑️ Removing room and cleaning up...');
        if (room) await this.roomImageService.removeRoomImage(room.id);
        if (room) await this.roomService.remove(room.id);
        console.log('✅ Room cleanup completed:', {
          socketId: socket.id,
          roomId: room?.id,
          roomName: data.name,
          userId: data.userId,
        });

        socket.to(data.name).emit('quit', { player: data.userId });
        socket.emit('room left', { roomId: room?.id });
        socket.disconnect();
      }
    } catch (error) {
      console.error('Error quitting room:', error);
      socket.emit('error', { message: 'Failed to quit room' });
    }
  }
}
