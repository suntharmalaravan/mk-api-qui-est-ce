import { Module } from '@nestjs/common';
import { Room as RoomEntity } from './entities/room.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { ImageModule } from 'src/image/image.module';
import { RoomImageModule } from 'src/room-image/room-image.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([RoomEntity]),
    ImageModule,
    RoomImageModule,
  ],
  providers: [RoomService],
  exports: [RoomService],
  controllers: [RoomController],
})
export class RoomModule {}
