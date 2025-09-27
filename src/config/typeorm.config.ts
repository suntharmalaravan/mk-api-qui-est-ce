import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { Image } from 'src/image/entities/image.entity';
import { Room } from 'src/room/entities/room.entity';
import { User } from 'src/user/entities/user.entity';
import { RoomImage } from 'src/room-image/entities/room-image.entity';
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => {
    return {
      type: 'mysql',
      host: configService.get<string>('DATABASE_host'),
      port: configService.get<number>('DATABASE_port'),
      username: configService.get<string>('DATABASE_username'),
      database: configService.get<string>('DATABASE_name'),
      password: configService.get<string>('DATABASE_password'),
      entities: [User, Room, Image, RoomImage],
      synchronize: false,
      logging: configService.get<string>('NODE_ENV') === 'development', // Log SQL en dev seulement
    };
  },
};

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DATABASE_host,
  port: parseInt(process.env.DATABASE_port, 10),
  username: process.env.DATABASE_username,
  database: process.env.DATABASE_name,
  password: process.env.DATABASE_password,
  entities: [User, Room, Image, RoomImage],
  synchronize: false,
};
