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
      console.log('👤 Fetching host information...');
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

      // Confirmer au client qui rejoint
      const hostJoinedData = {
        roomId: joinedRoom.id,
        roomName: data.name,
        hostId: joinedRoom.hostplayerid,
        hostName: hostName,
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
      if (!data.name || !data.question) {
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
        question: data.question,
      });
      socket.to(data.name).emit('ask', { question: data.question });
      socket.emit('question sent', { question: data.question });
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
      if (!data.name || !data.answer) {
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
      socket.to(data.name).emit('answer', { answer: data.answer });
      socket.emit('answer sent', { answer: data.answer });
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
      socket.to(data.name).emit('turn start', { player: data.player });
      socket.emit('turn changed', { player: data.player });
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
        socket.emit(`${data.player} won`);
        socket.to(data.name).emit(`${data.player} won`);
      } else {
        socket.emit(`${data.player} lost`);
        socket.to(data.name).emit(`${data.player} lost`);
      }
    } catch (error) {
      console.error('Error selecting character', error);
      socket.emit('error', { message: 'Failed to select character' });
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

      console.log('🗑️ Removing room and cleaning up...');
      await this.roomImageService.removeRoomImage(data.id);
      await this.roomService.remove(data.id);
      console.log('✅ Room cleanup completed:', {
        socketId: socket.id,
        roomId: data.id,
        roomName: data.name,
        userId: data.userId,
      });

      console.log('📡 Emitting quit events and disconnecting socket:', {
        socketId: socket.id,
        roomName: data.name,
        userId: data.userId,
      });
      socket.to(data.name).emit('quit', {
        player: data.userId,
      });
      socket.emit('room left', { roomId: data.id });
      socket.disconnect();
    } catch (error) {
      console.error('Error quitting room:', error);
      socket.emit('error', { message: 'Failed to quit room' });
    }
  }
}
