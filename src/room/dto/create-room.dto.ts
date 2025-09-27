import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(3, { message: 'Room name must be at least 3 characters long' })
  @MaxLength(30, { message: 'Room name must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Room name can only contain letters, numbers, underscores and hyphens',
  })
  name: string;

  @IsString()
  @IsOptional()
  status: string;

  @IsNumber()
  hostPlayerId: number;

  @IsNumber()
  @IsOptional()
  guestPlayerId: number;

  @IsNumber()
  @IsOptional()
  hostCharacterId: number;

  @IsNumber()
  @IsOptional()
  guestCharacterId: number;
}
