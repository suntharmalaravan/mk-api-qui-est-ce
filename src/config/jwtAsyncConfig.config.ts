import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions, JwtModuleOptions } from '@nestjs/jwt';

export const jwtAsyncOptions: JwtModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (
    configService: ConfigService,
  ): Promise<JwtModuleOptions> => ({
    secret: configService.get<string>('SECRET'),
    signOptions: {
      // Pas d'expiration - ATTENTION: Déconseillé en production
    },
  }),
};
