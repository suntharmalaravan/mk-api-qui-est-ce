import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
@WebSocketGateway()
export class RoomGateway {
  @WebSocketServer() wss: Server;
  constructor(private readonly roomService: RoomService) {}
  @SubscribeMessage('create')
  async createRoom(socket: Socket, data: any) {
    socket.join(data.name);
    const newRoom = await this.roomService.create({
      name: data.name,
      status: 'open',
      hostPlayerId: data.userId,
      guestPlayerId: 0,
      hostCharacterId: data.characterId,
      guestCharacterId: 0,
    });
    socket.to(data.name).emit('roomCreated', { room: data.name });
    return { event: 'roomCreated', room: data.name };
  }

  @SubscribeMessage('join')
  async joinRoom(socket: Socket, data: any) {
    socket.join(data.name);
    const updatedRoom = await this.roomService.addGuest(data.id, {
      guestPlayerId: data.userId,
      guestCharacterId: data.characterId,
    });
    socket.to(data.name).emit('guest joined');
  }

  @SubscribeMessage('quit')
  async quitRoom(socket: Socket, data: any) {
    await this.roomService.remove(data.name);
    socket.disconnect();
  }
}
