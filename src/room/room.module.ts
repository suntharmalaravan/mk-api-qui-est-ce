import { Module } from '@nestjs/common';
import { Room as RoomEntity } from './entities/room.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomService } from './room.service';
@Module({
  imports: [TypeOrmModule.forFeature([RoomEntity])],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
