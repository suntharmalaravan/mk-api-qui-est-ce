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
      expiresIn: '24h', // Token expire après 24h
    },
  }),
};
