import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User as UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}
  create(createUserDto: CreateUserDto) {
    const newUser = this.userRepository.create(createUserDto);
    return this.userRepository.save(newUser);
  }

  findOne(id: number) {
    return this.userRepository.findOne({
      select: { id: true, username: true, score: true, title: true },
      where: { id },
    });
  }

  findOneUsername(username: string) {
    const user = this.userRepository.findOne({
      select: { id: true, username: true, password: true },
      where: { username },
    });
    return user;
  }

  async updateScore(id: number, score: number) {
    const user = await this.userRepository.findOne({
      select: { score: true },
      where: { id },
    });
    user.score = score;
    await this.userRepository.update(id, user);
    return user;
  }

  remove(id: number) {
    return this.userRepository.delete({ id });
  }
}
