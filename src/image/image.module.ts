import { Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { Image as ImageEntity } from './entities/image.entity';
import { Deck } from './entities/deck.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageController } from './image.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageEntity, Deck]),
    FirebaseModule,
  ],
  providers: [ImageService],
  exports: [ImageService],
  controllers: [ImageController],
})
export class ImageModule { }
