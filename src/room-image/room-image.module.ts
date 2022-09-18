import { Module } from '@nestjs/common';
import { RoomImageService } from './room-image.service';
import { RoomImageController } from './room-image.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomImage as RoomImageEntity } from './entities/room-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoomImageEntity])],
  controllers: [RoomImageController],
  providers: [RoomImageService],
  exports: [RoomImageService],
})
export class RoomImageModule {}
