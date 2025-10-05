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
    try {
      // Validation des données requises
      if (!data.name || !data.userId || !data.category) {
        socket.emit('error', {
          message:
            'Missing required data: name, userId, and category are required',
        });
        return;
      }
      // Vérifier si la room existe déjà
      const existingRoom = await this.roomService.findByName(data.name);
      if (existingRoom) {
        console.log('la room existe');
        socket.emit('error', { message: 'Room with this name already exists' });
        return;
      }
      const room = await this.roomService.create({
        name: data.name,
        status: 'open',
        hostplayerid: data.userId,
        guestplayerid: null,
        hostcharacterid: null,
        guestcharacterid: null,
        category: data.category,
      });

      // Récupérer les images de la catégorie
      const images = await this.imageService.getUrlsByCategory(data.category);

      // Le créateur rejoint automatiquement sa propre room
      socket.join(data.name);

      // Notifier la création de la room
      const roomData = { room: data.name, roomId: room.id, images: images };
      socket.to(data.name).emit('roomCreated', roomData);
      socket.emit('roomCreated', roomData);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  }

  @SubscribeMessage('join')
  async joinRoom(socket: Socket, data: any) {
    try {
      // Validation des données requises
      if (!data.name || !data.userId) {
        socket.emit('error', {
          message: 'Missing required data: name and userId are required',
        });
        return;
      }

      // Vérifier et rejoindre la room en base de données d'abord
      const joinedRoom = await this.roomService.addGuest(data.name, {
        guestplayerid: data.userId,
      });

      // Si succès, rejoindre la room WebSocket
      socket.join(data.name);

      // Récupérer le username du joueur
      const user = await this.userService.findOne(parseInt(data.userId));
      const username = user ? user.username : `User-${data.userId}`;

      // Notifier les autres clients dans la room
      socket.to(data.name).emit('guest joined', {
        id: joinedRoom.id,
        userId: data.userId,
        username: username,
        socketId: socket.id,
      });

      // Confirmer au client qui rejoint
      socket.emit('joined', { roomId: joinedRoom.id, roomName: data.name });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('start')
  async startGame(socket: Socket, data: any) {
    try {
      if (!data.name) {
        socket.emit('error', { message: 'Room name is required' });
        return;
      }

      // Récupérer les informations de la room
      const room = await this.roomService.findByName(data.name);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Récupérer les images de la catégorie de la room
      const images = await this.imageService.getUrlsByCategory(room.category);

      // Envoyer les données avec la catégorie et les images
      const gameData = {
        roomName: data.name,
        category: room.category,
        images: images,
      };
      console.log(gameData);
      socket.to(data.name).emit('game started', gameData);
      socket.emit('game started', gameData);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  }

  @SubscribeMessage('question')
  async askQuestion(socket: Socket, data: any) {
    try {
      if (!data.name || !data.question) {
        socket.emit('error', {
          message: 'Missing required data: name and question are required',
        });
        return;
      }

      socket.to(data.name).emit('ask', { question: data.question });
      socket.emit('question sent', { question: data.question });
    } catch (error) {
      console.error('Error asking question:', error);
      socket.emit('error', { message: 'Failed to ask question' });
    }
  }

  @SubscribeMessage('answer')
  async answerQuestion(socket: Socket, data: any) {
    try {
      if (!data.name || !data.answer) {
        socket.emit('error', {
          message: 'Missing required data: name and answer are required',
        });
        return;
      }

      socket.to(data.name).emit('answer', { answer: data.answer });
      socket.emit('answer sent', { answer: data.answer });
    } catch (error) {
      console.error('Error answering question:', error);
      socket.emit('error', { message: 'Failed to answer question' });
    }
  }

  @SubscribeMessage('choose')
  async chooseCharacter(socket: Socket, data: any) {
    try {
      if (!data.name || !data.player || !data.characterId || !data.name) {
        socket.emit('error', {
          message:
            'Missing required data: id, player, characterId, and name are required',
        });
        return;
      }

      await this.roomService.chooseCharacter(
        data.name,
        data.player,
        data.characterId,
      );
      socket
        .to(data.name)
        .emit('player has chosen his character', { player: data.player });
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
    try {
      if (!data.name || !data.player) {
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      socket.to(data.name).emit('turn start', { player: data.player });
      socket.emit('turn changed', { player: data.player });
    } catch (error) {
      socket.emit('error', { message: 'Failed to change turn' });
    }
  }

  @SubscribeMessage('select')
  async selectCharacter(socket: Socket, data: any) {
    try {
      if (!data.name || !data.player || !data.characterId) {
        socket.emit('error', {
          message:
            'Missing required data: name, player, and characterId are required',
        });
        return;
      }
      const character = await this.roomService.selectCharacter(
        data.name,
        data.player,
        data.characterId,
      );
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
    try {
      if (!data.id || !data.name || !data.userId) {
        socket.emit('error', {
          message: 'Missing required data: id, name, and userId are required',
        });
        return;
      }

      await this.roomImageService.removeRoomImage(data.id);
      await this.roomService.remove(data.id);
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
