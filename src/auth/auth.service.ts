import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}
  async register(input: CreateUserDto) {
    const username = input.username.trim();
    if (await this.userService.findOneUsername(username))
      throw new ConflictException('Cet identifiant est déjà utilisé.');
    const password = await bcrypt.hash(input.password, 12);
    try {
      return await this.userService.create({ username, password });
    } catch (error) {
      // The database arbitrates simultaneous registrations, including case variants.
      if (
        error?.code === '23505' &&
        error?.constraint === 'user_public_identifier_unique'
      )
        throw new ConflictException('Cet identifiant est déjà utilisé.');
      throw error;
    }
  }
  async login(input: LoginDto) {
    const user = await this.userService.findOneUsername(input.username);
    if (
      !user?.password ||
      !(await bcrypt.compare(input.password, user.password))
    )
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    return user;
  }
}
