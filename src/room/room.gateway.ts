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

  // Map pour tracker les utilisateurs connectés par room
  // Structure: roomName -> { host: { socketId, userId }, guest: { socketId, userId } }
  private connectedUsers = new Map<
    string,
    {
      host?: { socketId: string; userId: string };
      guest?: { socketId: string; userId: string };
    }
  >();

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
      // Trouver dans quelle room cet utilisateur était connecté
      let disconnectedRoom: string | null = null;
      let disconnectedUser: {
        userId: string;
        role: 'host' | 'guest';
      } | null = null;

      for (const [roomName, users] of this.connectedUsers.entries()) {
        if (users.host?.socketId === socketId) {
          disconnectedRoom = roomName;
          disconnectedUser = {
            userId: users.host.userId,
            role: 'host',
          };
          break;
        } else if (users.guest?.socketId === socketId) {
          disconnectedRoom = roomName;
          disconnectedUser = {
            userId: users.guest.userId,
            role: 'guest',
          };
          break;
        }
      }

      if (!disconnectedRoom || !disconnectedUser) {
        console.log(
          'ℹ️ Utilisateur déconnecté non trouvé dans les rooms actives:',
          socketId,
        );
        return;
      }

      console.log('🚫 Utilisateur déconnecté détecté:', {
        socketId,
        roomName: disconnectedRoom,
        userId: disconnectedUser.userId,
        role: disconnectedUser.role,
        timestamp: new Date().toISOString(),
      });

      // Notifier l'autre joueur de la déconnexion
      await this.notifyUserDisconnection(disconnectedRoom, disconnectedUser);

      // Nettoyer la room
      this.cleanupDisconnectedUser(disconnectedRoom, disconnectedUser.role);
    } catch (error) {
      console.error('❌ Erreur lors de la gestion de la déconnexion:', error);
    }
  }

  /**
   * Notifie l'autre joueur de la déconnexion
   */
  private async notifyUserDisconnection(
    roomName: string,
    disconnectedUser: { userId: string; role: 'host' | 'guest' },
  ) {
    try {
      const roomUsers = this.connectedUsers.get(roomName);
      if (!roomUsers) return;

      // Déterminer qui est l'autre joueur
      const otherPlayer =
        disconnectedUser.role === 'host' ? roomUsers.guest : roomUsers.host;

      if (otherPlayer) {
        // Récupérer les informations de l'utilisateur déconnecté
        const user = await this.userService.findOne(
          parseInt(disconnectedUser.userId),
        );
        const username = user
          ? user.username
          : `User-${disconnectedUser.userId}`;

        console.log(
          "📡 Notification de déconnexion envoyée à l'autre joueur:",
          {
            roomName,
            disconnectedUser: {
              userId: disconnectedUser.userId,
              username,
              role: disconnectedUser.role,
            },
            notifiedPlayer: {
              socketId: otherPlayer.socketId,
              userId: otherPlayer.userId,
            },
          },
        );

        // Notifier l'autre joueur
        this.wss.to(otherPlayer.socketId).emit('playerDisconnected', {
          disconnectedPlayer: {
            userId: disconnectedUser.userId,
            username: username,
            role: disconnectedUser.role,
          },
          message: `${username} s'est déconnecté(e). La partie est terminée.`,
          timestamp: new Date().toISOString(),
        });
      }

      // Gestion selon le rôle: si guest quitte avant le début, on rouvre la room
      const room = await this.roomService.findByName(roomName);
      if (room) {
        const isGuestLeaving = disconnectedUser.role === 'guest';
        const gameStarted = !!(room.hostcharacterid || room.guestcharacterid);

        if (isGuestLeaving && !gameStarted) {
          console.log(
            '🔁 Guest a quitté avant le début: réouverture de la room',
            {
              roomId: room.id,
              roomName,
            },
          );
          await this.roomService.reopenRoomAfterGuestLeaves(roomName);
          // Notifier l'host que le guest est parti
          const tracked = this.connectedUsers.get(roomName);
          const host = tracked?.host;
          if (host?.socketId) {
            this.wss.to(host.socketId).emit('guestLeftBeforeStart', {
              roomId: room.id,
              roomName,
            });
          }
        } else {
          console.log('🗑️ Suppression de la room suite à la déconnexion:', {
            roomId: room.id,
            roomName,
            reason: 'user_disconnected',
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
   * Nettoie les données de l'utilisateur déconnecté
   */
  private cleanupDisconnectedUser(roomName: string, role: 'host' | 'guest') {
    const roomUsers = this.connectedUsers.get(roomName);
    if (!roomUsers) return;

    if (role === 'host') {
      delete roomUsers.host;
    } else {
      delete roomUsers.guest;
    }

    // Si plus personne dans la room, supprimer l'entrée
    if (!roomUsers.host && !roomUsers.guest) {
      this.connectedUsers.delete(roomName);
      console.log('🧹 Room supprimée du tracking:', roomName);
    } else {
      console.log('🧹 Utilisateur supprimé du tracking:', { roomName, role });
    }
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

      // Tracker l'utilisateur host dans la room
      if (!this.connectedUsers.has(data.name)) {
        this.connectedUsers.set(data.name, {});
      }
      this.connectedUsers.get(data.name).host = {
        socketId: socket.id,
        userId: data.userId.toString(),
      };
      console.log('👤 Host tracké dans la room:', {
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

      // Tracker l'utilisateur guest dans la room
      if (!this.connectedUsers.has(data.name)) {
        this.connectedUsers.set(data.name, {});
      }
      this.connectedUsers.get(data.name).guest = {
        socketId: socket.id,
        userId: data.userId.toString(),
      };
      console.log('👤 Guest tracké dans la room:', {
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

      // Récupérer les sockets des joueurs connectés
      const roomUsers = this.connectedUsers.get(roomName);
      console.log('🔍 Room users for rematch:', roomUsers);
      if (!roomUsers) return;

      const hostSocket = roomUsers.host
        ? this.wss.sockets.sockets.get(roomUsers.host.socketId)
        : null;
      const guestSocket = roomUsers.guest
        ? this.wss.sockets.sockets.get(roomUsers.guest.socketId)
        : null;
      console.log('🔍 Host socket for rematch:', hostSocket);
      console.log('🔍 Guest socket for rematch:', guestSocket);
      // Vérifier si l'autre joueur a déjà envoyé l'événement
      const otherSocket = player === 'host' ? guestSocket : hostSocket;
      const currentSocket = player === 'host' ? hostSocket : guestSocket;

      if (otherSocket && otherSocket.data.playAgainRequested) {
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
      const tracked = this.connectedUsers.get(data.name);
      const isGuest = tracked?.guest?.socketId === socket.id;
      const gameStarted = !!(room?.hostcharacterid || room?.guestcharacterid);

      if (isGuest && !gameStarted) {
        // Guest quitte avant le début: rouvrir la room, nettoyer seulement le guest
        await this.roomService.reopenRoomAfterGuestLeaves(data.name);
        if (tracked) delete tracked.guest;
        console.log(
          '🔁 Guest left before start: room reopened and guest removed from tracking',
        );
        // Notifier l'host uniquement
        if (tracked?.host?.socketId) {
          this.wss.to(tracked.host.socketId).emit('guestLeftBeforeStart', {
            roomId: room?.id,
            roomName: data.name,
          });
        }
        // Confirmer au guest
        socket.emit('room left', { roomId: room?.id });
        socket.leave(data.name);
        socket.disconnect();
      } else {
        // Cas host qui quitte ou partie déjà démarrée: comportement actuel (supprimer la room)
        console.log('🗑️ Removing room and cleaning up...');
        if (room) await this.roomImageService.removeRoomImage(room.id);
        if (room) await this.roomService.remove(room.id);
        console.log('✅ Room cleanup completed:', {
          socketId: socket.id,
          roomId: room?.id,
          roomName: data.name,
          userId: data.userId,
        });
        this.connectedUsers.delete(data.name);
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
