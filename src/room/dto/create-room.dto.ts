export class CreateRoomDto {
  name: string;
  status: string;
  hostPlayerId: number;
  guestPlayerId: number;
  hostCharacterId: number;
  guestCharacterId: number;
}
