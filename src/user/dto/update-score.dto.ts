import { IsNumber, Min } from 'class-validator';

export class UpdateScoreDto {
  @IsNumber({}, { message: 'Score must be a number' })
  @Min(0, { message: 'Score must be greater than or equal to 0' })
  score: number;
}
