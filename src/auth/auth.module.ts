import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import AuthController from './auth.controller';
import { UserModule } from '../user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtAsyncOptions } from 'src/config/jwtAsyncConfig.config';
import { JwtStrategy } from './auth.strategy';

@Module({
  imports: [UserModule, JwtModule.registerAsync(jwtAsyncOptions)],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
