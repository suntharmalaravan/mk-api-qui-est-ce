import { NotAcceptableException } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
import { ImageService } from 'src/image/image.service';
@WebSocketGateway()
export class RoomGateway {
  @WebSocketServer() wss: Server;
  constructor(
    private readonly roomService: RoomService,
    private readonly imageService: ImageService,
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
      guestPlayerId: data.userId,
      hostCharacterId: data.characterId,
      guestCharacterId: data.characterId,
    });
    const images = await this.imageService.getUrlsByCategory(data.category);
    socket.to(data.name).emit('roomCreated', { room: data.name });
    return { event: 'roomCreated', room: data.name };
  }

  @SubscribeMessage('join')
  async joinRoom(socket: Socket, data: any) {
    socket.join(data.name);
    await this.roomService.addGuest(data.id, {
      guestPlayerId: data.userId,
    });
    socket.to(data.name).emit('guest joined');
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
    await this.roomService.remove(data.id);
    socket.to(data.name).emit('quit', {
      player: data.userId,
    });
    socket.disconnect();
  }
}
