import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
export class OperationDto {
  @IsString() @Matches(/^[a-zA-Z0-9:_-]{1,150}$/) operationId: string;
}
export class CharacterDto extends OperationDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) id: string;
  @IsString() @MaxLength(100) name: string;
  @IsInt() @Min(0) @Max(2147483646) expectedRevision: number;
  @IsObject() recipe: Record<string, unknown>;
}
export class DeleteCharacterDto extends OperationDto {
  @IsInt() @Min(1) @Max(2147483646) expectedRevision: number;
}
export class PurchaseDto extends OperationDto {
  @IsString() @MaxLength(80) itemId: string;
  @IsInt() @Min(0) @Max(1000000) expectedPrice: number;
}
export class CharacterReferenceDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) id: string;
  @IsInt() @Min(1) @Max(2147483646) revision: number;
}
export class PublishDto extends OperationDto {
  @IsOptional() @IsInt() @Min(1) deckId?: number;
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => CharacterReferenceDto)
  characters: CharacterReferenceDto[];
}
