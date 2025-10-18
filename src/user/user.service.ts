import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User as UserEntity } from './entities/user.entity';
import { Level as LevelEntity } from './entities/level.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(LevelEntity)
    private readonly levelRepository: Repository<LevelEntity>,
  ) {}
  create(createUserDto: CreateUserDto) {
    const newUser = this.userRepository.create({
      ...createUserDto,
      score: 0, // Valeur par défaut explicite
      title: 'debutant', // Valeur par défaut explicite
    });
    return this.userRepository.save(newUser);
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      select: {
        id: true,
        username: true,
        score: true,
        title: true,
        image_url: true,
      },
      where: { id },
    });

    if (!user) {
      return null;
    }

    // Récupérer les informations du niveau basé sur le score
    const levelInfo = await this.getLevelInfo(user.score);

    return {
      ...user,
      currentLevel: levelInfo.currentLevel,
      minScore: levelInfo.minScore,
      maxScore: levelInfo.maxScore,
    };
  }

  private async getLevelInfo(userScore: number) {
    // Récupérer tous les niveaux triés par score
    const levels = await this.levelRepository.find({
      order: { score: 'ASC' },
    });

    // Trouver le niveau actuel (le plus haut niveau dont le score est <= au score du joueur)
    let currentLevel = levels[0];
    for (const level of levels) {
      if (userScore >= level.score) {
        currentLevel = level;
      } else {
        break;
      }
    }

    // Trouver le niveau suivant pour déterminer maxScore
    const currentLevelIndex = levels.findIndex((l) => l.id === currentLevel.id);
    const nextLevel =
      currentLevelIndex < levels.length - 1
        ? levels[currentLevelIndex + 1]
        : null;

    return {
      currentLevel: currentLevel.id,
      minScore: currentLevel.score,
      maxScore: nextLevel ? nextLevel.score : null,
    };
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

  async updateImageUrl(id: number, imageUrl: string): Promise<void> {
    await this.userRepository.update(id, { image_url: imageUrl });
  }

  remove(id: number) {
    return this.userRepository.delete({ id });
  }
}
