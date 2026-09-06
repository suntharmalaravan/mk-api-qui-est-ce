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
  hostplayerid: number;

  @IsNumber()
  @IsOptional()
  guestplayerid: number | null;

  @IsNumber()
  @IsOptional()
  hostcharacterid: number | null;

  @IsNumber()
  @IsOptional()
  guestcharacterid: number | null;

  @IsString()
  category: string;

  @IsString()
  @IsOptional()
  mode: string; // 'category' | 'custom'

  @IsNumber()
  @IsOptional()
  custom_library_user_id: number | null;

  @IsNumber()
  @IsOptional()
  deck_id?: number | null; // Pour les parties avec un deck sauvegardé
}
