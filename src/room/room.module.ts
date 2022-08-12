import { Module } from '@nestjs/common';
import { Room as RoomEntity } from './entities/room.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RoomImage as RoomImageEntity } from './entities/roomImage.entity';
import { ImageService } from 'src/image/image.service';
import { ImageModule } from 'src/image/image.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([RoomEntity, RoomImageEntity]),
    ImageModule,
  ],
  providers: [RoomService],
  exports: [RoomService],
  controllers: [RoomController],
})
export class RoomModule {}
