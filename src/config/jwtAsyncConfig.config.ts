import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions, JwtModuleOptions } from '@nestjs/jwt';

export const jwtAsyncOptions: JwtModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (
    configService: ConfigService,
  ): Promise<JwtModuleOptions> => {
    const secret = configService.get<string>('SECRET');
    if (!secret) throw new Error('SECRET is required to sign and verify JWTs');

    return {
      secret,
      signOptions: {
        expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1d',
      },
    };
  },
};
