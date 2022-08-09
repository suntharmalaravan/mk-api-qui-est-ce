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
  createRoom(socket: Socket, data: any) {
    console.log(data);
    socket.join(data.roomName);
    const newRoom = this.roomService.create({
      name: data.roomName,
      status: 'open',
      hostPlayerId: data.userId,
      guestPlayerId: 0,
      hostCharacterId: data.characterId,
      guestCharacterId: 0,
    });
    console.log(newRoom);
    socket.to(data.roomName).emit('roomCreated', { room: data.roomName });
    console.log('created');
    return { event: 'roomCreated', room: data.roomName };
  }
}
