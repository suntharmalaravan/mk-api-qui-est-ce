import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (): Promise<TypeOrmModuleOptions> => {
    return {
      type: 'mysql',
      host: process.env.DATABASE_host,
      port: parseInt(process.env.DATABASE_port, 10),
      username: process.env.DATABASE_username,
      database: process.env.DATABASE_name,
      password: process.env.DATABASE_password,
      entities: [User],
      synchronize: false,
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
  entities: [User],
  synchronize: false,
};
