import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}
  async register(createUserDto: CreateUserDto) {
    const ifUserExists =
      (await this.userService.findOneUsername(createUserDto.username)) != null;
    if (ifUserExists == false) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 12);
      return this.userService.create(createUserDto);
    } else
      throw new BadRequestException('user exists already with this username');
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findOneUsername(loginDto.username);
    if (user != null) {
      const passwordMatch = await bcrypt.compare(
        loginDto.password,
        user.password,
      );
      if (passwordMatch) {
        return user;
      } else throw new BadRequestException('invalid password');
    } else throw new BadRequestException('invalid username');
  }
}
