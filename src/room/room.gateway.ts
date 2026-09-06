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
  ) { }

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
      mode: 'category',
      custom_library_user_id: null,
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
    const guest = await this.userService.findOne(
      parseInt(room.guestplayerid.toString()),
    );
    const hostName = host ? host.username : `User-${room.hostplayerid}`;
    const guestName = guest ? guest.username : `User-${room.guestplayerid}`;
    console.log('Notify Guest Connection ', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      guestName: guestName,
      guestId: room.guestplayerid,
      category: room.category,
    });
    // Récupérer les images de la catégorie de la room
    const images = await this.imageService.getUrlsByCategory(room.category);
    socket.to(room.name).emit('joined', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      category: room.category,
      guestName: guestName,
      guestId: room.guestplayerid,
      images: images,
    });
    socket.emit('joined', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      guestName: guestName,
      guestId: room.guestplayerid,
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
      const mode = data.mode || 'category';

      if (mode === 'category') {
        if (!data.name || !data.userId || !data.category) {
          console.log('❌ Validation failed for create room (category):', {
            socketId: socket.id,
            missingFields: {
              name: !data.name,
              userId: !data.userId,
              category: !data.category,
            },
          });
          socket.emit('error', {
            message: 'Missing required data: name, userId, and category are required',
          });
          return;
        }
      } else if (mode === 'custom') {
        if (!data.name || !data.userId) {
          console.log('❌ Validation failed for create room (custom):', {
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

      let images: any[];

      if (mode === 'custom') {
        // Mode bibliothèque personnelle
        const deckId = data.deckId;

        if (deckId) {
          // Nouveau système: utiliser un deck sauvegardé
          console.log('📚 Mode custom avec deck:', { userId: data.userId, deckId });

          // Vérifier que le deck existe et appartient à l'utilisateur
          const deckImages = await this.imageService.getDeckImagesById(deckId);

          if (deckImages.length < 18) {
            console.log('❌ Deck invalide ou pas assez d\'images:', { deckId, count: deckImages.length });
            socket.emit('error', {
              message: 'Deck invalide ou ne contient pas assez d\'images (minimum 18)',
            });
            return;
          }

          images = deckImages;
          console.log('📸 Images du deck récupérées:', {
            deckId,
            imageCount: images.length,
          });
        } else {
          // Legacy: utiliser toutes les images de l'utilisateur
          console.log('📚 Mode custom legacy: bibliothèque user:', data.userId);

          // Vérifier le nombre d'images
          const imageCount = await this.imageService.count(data.userId);
          if (imageCount < 18) {
            console.log('❌ Pas assez d\'images:', { userId: data.userId, count: imageCount });
            socket.emit('error', {
              message: `Vous devez avoir au moins 18 images dans votre bibliothèque (vous en avez ${imageCount})`,
            });
            return;
          }

          // Récupérer les images de la bibliothèque
          images = await this.imageService.findByUserId(data.userId);
          console.log('📸 Images bibliothèque récupérées:', {
            userId: data.userId,
            imageCount: images.length,
          });
        }
      } else {
        // Mode catégorie
        console.log('🖼️ Fetching images for category:', data.category);
        images = await this.imageService.getUrlsByCategory(data.category);
        console.log('📸 Images category retrieved:', {
          category: data.category,
          imageCount: images.length,
        });

        // Même contrôle qu'en mode custom : sans ces 18 images la partie ne
        // pourra pas démarrer, autant le dire avant de créer la room.
        if (images.length < 18) {
          console.log('❌ Catégorie insuffisante:', {
            category: data.category,
            count: images.length,
          });
          socket.emit('error', {
            message: `La catégorie "${data.category}" ne contient pas assez d'images (${images.length}/18)`,
          });
          return;
        }
      }

      console.log('📝 Creating new room in database...');
      const room = await this.roomService.create({
        name: data.name,
        status: 'open',
        hostplayerid: data.userId,
        guestplayerid: null,
        hostcharacterid: null,
        guestcharacterid: null,
        category: mode === 'category' ? data.category : 'custom',
        mode: mode,
        custom_library_user_id: mode === 'custom' ? data.userId : null,
        deck_id: data.deckId || null, // Sauvegarder le deckId pour les parties custom
      });
      console.log('✅ Room created successfully:', {
        socketId: socket.id,
        roomId: room.id,
        roomName: room.name,
        hostId: room.hostplayerid,
        mode: room.mode,
        category: room.category,
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
        mode: mode,
      });

      // Notifier la création de la room
      const roomData = {
        room: data.name,
        roomId: room.id,
        images: images,
        mode: mode,
      };
      console.log('📡 Emitting roomCreated event:', {
        socketId: socket.id,
        roomData: { ...roomData, images: `[${images.length} images]` },
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

      // Récupérer les images selon le mode de la room
      let images: any[];
      const roomMode = (joinedRoom as any).mode || 'category';

      if (roomMode === 'custom') {
        // Mode bibliothèque personnelle - récupérer les images du host
        const customLibraryUserId = (joinedRoom as any).custom_library_user_id || joinedRoom.hostplayerid;
        console.log('📚 Mode custom: récupération bibliothèque user:', customLibraryUserId);
        images = await this.imageService.findByUserId(customLibraryUserId);
        console.log('📸 Images bibliothèque récupérées:', {
          ownerId: customLibraryUserId,
          imageCount: images.length,
        });
      } else {
        // Mode catégorie
        console.log('🖼️ Fetching images for room category:', joinedRoom.category);
        images = await this.imageService.getUrlsByCategory(joinedRoom.category);
        console.log('📸 Images category retrieved:', {
          category: joinedRoom.category,
          imageCount: images.length,
        });
      }

      // Confirmer au client qui rejoint
      const hostJoinedData = {
        roomId: joinedRoom.id,
        roomName: data.name,
        hostId: joinedRoom.hostplayerid,
        hostName: hostName,
        category: joinedRoom.category,
        images: images,
        mode: roomMode,
      };
      console.log('📡 Emitting joined confirmation:', {
        socketId: socket.id,
        hostJoinedData: { ...hostJoinedData, images: `[${images.length} images]` },
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
        mode: room.mode,
        deck_id: room.deck_id,
      });

      // Récupérer les images selon le mode
      let images: any[];

      if (room.mode === 'custom' && room.deck_id) {
        // Mode custom avec deck: récupérer les images du deck
        console.log('🖼️ Fetching images from deck:', room.deck_id);
        images = await this.imageService.getDeckImagesById(room.deck_id);
        console.log('📸 Deck images retrieved:', {
          deckId: room.deck_id,
          imageCount: images.length,
        });
      } else if (room.mode === 'custom' && room.custom_library_user_id) {
        // Mode custom legacy: récupérer toutes les images de l'utilisateur
        console.log('🖼️ Fetching user library images:', room.custom_library_user_id);
        images = await this.imageService.findByUserId(room.custom_library_user_id);
        console.log('📸 User library images retrieved:', {
          userId: room.custom_library_user_id,
          imageCount: images.length,
        });
      } else {
        // Mode catégorie
        console.log('🖼️ Fetching images for category:', room.category);
        images = await this.imageService.getUrlsByCategory(room.category);
        console.log('📸 Category images retrieved:', {
          category: room.category,
          imageCount: images.length,
        });
      }

      if (images.length < 18) {
        console.log('❌ Not enough images:', { count: images.length });
        socket.emit('error', { message: 'Pas assez d\'images pour démarrer la partie (minimum 18)' });
        return;
      }

      // Envoyer les données avec la catégorie et les images
      const gameData = {
        roomName: data.name,
        category: room.category,
        images: images,
      };
      console.log('📡 Emitting game started event:', {
        socketId: socket.id,
        roomName: data.name,
        imageCount: images.length,
        mode: room.mode,
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

        // Mettre à jour le score du joueur gagnant (+8 points)
        const winnerUserId =
          data.player === 'host' ? room.hostplayerid : room.guestplayerid;

        console.log('👤 [selectCharacter] Détermination du gagnant:', {
          socketId: socket.id,
          roomName: data.name,
          player: data.player,
          winnerUserId: winnerUserId,
          hostPlayerId: room.hostplayerid,
          guestPlayerId: room.guestplayerid,
        });

        if (winnerUserId) {
          console.log('🔍 [selectCharacter] Recherche de l\'utilisateur gagnant:', {
            socketId: socket.id,
            winnerUserId: winnerUserId,
          });

          const winnerUser = await this.userService.findOne(winnerUserId);

          console.log('👤 [selectCharacter] Utilisateur gagnant trouvé:', {
            socketId: socket.id,
            winnerUserId: winnerUserId,
            userFound: !!winnerUser,
            currentScore: winnerUser?.score,
          });

          if (winnerUser) {
            const newScore = winnerUser.score + 8;
            console.log('💰 [selectCharacter] Calcul du nouveau score:', {
              socketId: socket.id,
              userId: winnerUserId,
              player: data.player,
              oldScore: winnerUser.score,
              newScore: newScore,
              pointsToAdd: 8,
            });

            try {
              await this.userService.updateScore(winnerUserId, newScore);
              console.log('✅ [selectCharacter] Score mis à jour avec succès:', {
                socketId: socket.id,
                userId: winnerUserId,
                player: data.player,
                oldScore: winnerUser.score,
                newScore: newScore,
              });
            } catch (error) {
              console.error('❌ [selectCharacter] Erreur lors de la mise à jour du score:', {
                socketId: socket.id,
                userId: winnerUserId,
                player: data.player,
                error: error.message,
                errorStack: error.stack,
              });
              throw error;
            }
          } else {
            console.warn('⚠️ [selectCharacter] Utilisateur gagnant non trouvé:', {
              socketId: socket.id,
              winnerUserId: winnerUserId,
              player: data.player,
            });
          }
        } else {
          console.warn('⚠️ [selectCharacter] winnerUserId est null ou undefined:', {
            socketId: socket.id,
            player: data.player,
            hostPlayerId: room.hostplayerid,
            guestPlayerId: room.guestplayerid,
          });
        }

        // Émettre les événements de victoire/défaite
        console.log('📡 [selectCharacter] Émission des événements de victoire:', {
          socketId: socket.id,
          roomName: data.name,
          eventName: eventName,
          player: data.player,
        });

        socket.emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        socket.to(data.name).emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        console.log('✅ [selectCharacter] Événements de victoire émis avec succès:', {
          socketId: socket.id,
          roomName: data.name,
          eventName: eventName,
          emittedToSelf: true,
          emittedToRoom: true,
        });

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
        // Émettre les événements de victoire/défaite même en cas de perte
        console.log('📡 [selectCharacter] Émission des événements de défaite:', {
          socketId: socket.id,
          roomName: data.name,
          eventName: eventName,
          player: data.player,
        });

        socket.emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        socket.to(data.name).emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        console.log('✅ [selectCharacter] Événements de défaite émis avec succès:', {
          socketId: socket.id,
          roomName: data.name,
          eventName: eventName,
        });

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
      socket.join(data.newRoomName)
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

      socket.join(data.newRoomName)

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
