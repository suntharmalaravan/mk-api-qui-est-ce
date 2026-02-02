import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { Image } from 'src/image/entities/image.entity';
import { Deck } from 'src/image/entities/deck.entity';
import { Room } from 'src/room/entities/room.entity';
import { User } from 'src/user/entities/user.entity';
import { Level } from 'src/user/entities/level.entity';
import { RoomImage } from 'src/room-image/entities/room-image.entity';
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => {
    // Log des variables d'environnement pour debug (à supprimer après)
    console.log("🔍 Debug variables d'environnement:");
    console.log(
      'DATABASE_URL:',
      configService.get<string>('DATABASE_URL')
        ? '✅ Définie'
        : '❌ Non définie',
    );
    console.log('DATABASE_host:', configService.get<string>('DATABASE_host'));
    console.log('DATABASE_port:', configService.get<number>('DATABASE_port'));
    console.log(
      'DATABASE_username:',
      configService.get<string>('DATABASE_username'),
    );
    console.log('DATABASE_name:', configService.get<string>('DATABASE_name'));
    console.log(
      'DATABASE_password:',
      configService.get<string>('DATABASE_password')
        ? '✅ Définie'
        : '❌ Non définie',
    );
    console.log('NODE_ENV:', configService.get<string>('NODE_ENV'));

    // Utiliser l'URL de connexion complète si disponible, sinon utiliser les paramètres individuels
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (databaseUrl) {
      return {
        type: 'postgres',
        url: databaseUrl,
        entities: [User, Room, Image, Deck, RoomImage, Level],
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
        ssl: {
          rejectUnauthorized: false,
        },
      };
    }

    return {
      type: 'postgres',
      host: configService.get<string>('DATABASE_host'),
      port: configService.get<number>('DATABASE_port'),
      username: configService.get<string>('DATABASE_username'),
      database: configService.get<string>('DATABASE_name'),
      password: configService.get<string>('DATABASE_password'),
      entities: [User, Room, Image, Deck, RoomImage, Level],
      synchronize: false,
      logging: configService.get<string>('NODE_ENV') === 'development',
      ssl: {
        rejectUnauthorized: false,
      },
      // Forcer IPv4 pour éviter les problèmes de connectivité
      extra: {
        family: 4, // Force IPv4
      },
    };
  },
};

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DATABASE_host,
  port: parseInt(process.env.DATABASE_port, 10),
  username: process.env.DATABASE_username,
  database: process.env.DATABASE_name,
  password: process.env.DATABASE_password,
  entities: [User, Room, Image, Deck, RoomImage, Level],
  synchronize: false,
  ssl: {
    rejectUnauthorized: false, // Nécessaire pour Supabase
  },
};
