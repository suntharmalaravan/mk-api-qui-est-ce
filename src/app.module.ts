import { SocialModule } from './social/social.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { ConfigModule } from '@nestjs/config';
import { RoomGateway } from './room/room.gateway';
import { RoomModule } from './room/room.module';
import { ImageModule } from './image/image.module';
import { RoomImageModule } from './room-image/room-image.module';
import { AtelierModule } from './atelier/atelier.module';
import { ProgressionModule } from './progression/progression.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    UserModule,
    AuthModule,
    RoomModule,
    ImageModule,
    RoomImageModule,
    AtelierModule,
    ProgressionModule,
    LeaderboardModule,
    SocialModule,
  ],
  controllers: [AppController],
  providers: [AppService, RoomGateway],
})
export class AppModule {}
