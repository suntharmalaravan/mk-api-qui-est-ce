import { NotAcceptableException } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
import { ImageService } from 'src/image/image.service';
import { RoomImageService } from 'src/room-image/room-image.service';
@WebSocketGateway()
export class RoomGateway {
  @WebSocketServer() wss: Server;
  constructor(
    private readonly roomService: RoomService,
    private readonly imageService: ImageService,
    private readonly roomImageService: RoomImageService,
  ) {}
  @SubscribeMessage('create')
  async createRoom(socket: Socket, data: any) {
    const existingRoom = await this.roomService.findByName(data.name);
    if (existingRoom) {
      throw new NotAcceptableException('Room with this name already exists');
    }
    const room = await this.roomService.create({
      name: data.name,
      status: 'open',
      hostPlayerId: data.userId,
      guestPlayerId: null,
      hostCharacterId: null,
      guestCharacterId: null,
    });
    const images = await this.imageService.getUrlsByCategory(data.category);
    for (let i = 0; i < images.length; i++) {
      await this.roomImageService.insertRoomImage({
        fk_image: images[i].id,
        fk_room: room.id,
      });
    }
    socket.to(data.name).emit('roomCreated', { room: data.name });
    return { event: 'roomCreated', room: data.name };
  }

  @SubscribeMessage('join')
  async joinRoom(socket: Socket, data: any) {
    socket.join(data.name);
    const joinedRoom = await this.roomService.addGuest(data.name, {
      guestPlayerId: data.userId,
    });
    socket.to(data.name).emit('guest joined', { id: joinedRoom.id });
  }

  @SubscribeMessage('start')
  async startGame(socket: Socket, data: any) {
    socket.to(data.name).emit('start the game');
  }

  @SubscribeMessage('question')
  async askQuestion(socket: Socket, data: any) {
    socket.to(data.name).emit('ask', { question: data.question });
  }

  @SubscribeMessage('answer')
  async answerQuestion(socket: Socket, data: any) {
    socket.to(data.name).emit('answer', { answer: data.answer });
  }

  @SubscribeMessage('choose')
  async chooseCharacter(socket: Socket, data: any) {
    this.roomService.chooseCharacter(data.id, data.player, data.characterId);
    socket
      .to(data.name)
      .emit('player has chosen his character', { player: data.player });
  }

  @SubscribeMessage('change turn')
  async changeTurn(socket: Socket, data: any) {
    socket.to(data.name).emit('turn start', { player: data.player });
  }

  @SubscribeMessage('quit')
  async quitRoom(socket: Socket, data: any) {
    await this.roomImageService.removeRoomImage(data.id);
    await this.roomService.remove(data.id);
    socket.to(data.name).emit('quit', {
      player: data.userId,
    });
    socket.disconnect();
  }
}
