import { Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { Image as ImageEntity } from './entities/image.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageController } from './image.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImageEntity])],
  providers: [ImageService],
  exports: [ImageService],
  controllers: [ImageController],
})
export class ImageModule {}
