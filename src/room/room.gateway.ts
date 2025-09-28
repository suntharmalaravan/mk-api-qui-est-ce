import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
import { ImageService } from 'src/image/image.service';
import { RoomImageService } from 'src/room-image/room-image.service';
@WebSocketGateway({
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
  ) {}
  @SubscribeMessage('create')
  async createRoom(socket: Socket, data: any) {
    console.log('🎯 Event: create room', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });
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
        socket.emit('error', { message: 'Room with this name already exists' });
        return;
      }

      // Créer la room avec les noms de propriétés corrigés
      const room = await this.roomService.create({
        name: data.name,
        status: 'open',
        hostplayerid: data.userId,
        guestplayerid: null,
        hostcharacterid: null,
        guestcharacterid: null,
      });

      // Ajouter les images de la catégorie
      const images = await this.imageService.getUrlsByCategory(data.category);
      for (let i = 0; i < images.length; i++) {
        await this.roomImageService.insertRoomImage({
          fk_image: images[i].id,
          fk_room: room.id,
        });
      }

      // Notifier la création de la room
      socket.to(data.name).emit('roomCreated', { room: data.name });
      socket.emit('roomCreated', { room: data.name, roomId: room.id });
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
        socket.emit('error', {
          message: 'Missing required data: name and userId are required',
        });
        return;
      }

      socket.join(data.name);
      const joinedRoom = await this.roomService.addGuest(data.name, {
        guestplayerid: data.userId,
      });

      socket.to(data.name).emit('guest joined', { id: joinedRoom.id });
      socket.emit('joined', { roomId: joinedRoom.id, roomName: data.name });
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
        socket.emit('error', { message: 'Room name is required' });
        return;
      }

      socket.to(data.name).emit('start the game');
      socket.emit('game started', { roomName: data.name });
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
    console.log('💬 Event: answer question', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });
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
    console.log('👤 Event: choose character', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });
    try {
      if (!data.id || !data.player || !data.characterId || !data.name) {
        socket.emit('error', {
          message:
            'Missing required data: id, player, characterId, and name are required',
        });
        return;
      }

      await this.roomService.chooseCharacter(
        data.id,
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
    console.log('🔄 Event: change turn', {
      socketId: socket.id,
      data: data,
      timestamp: new Date().toISOString(),
    });
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
      console.error('Error changing turn:', error);
      socket.emit('error', { message: 'Failed to change turn' });
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
