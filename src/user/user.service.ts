import { rankForScore } from '../atelier/loupe-economy';
import { Injectable, ForbiddenException } from '@nestjs/common';
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
      public_identifier: createUserDto.username.trim().toLowerCase(),
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
        public_identifier: true,
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
      title: levelInfo.title,
      currentLevel: levelInfo.levelId,
      rank: rankForScore(user.score),
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
      title: currentLevel.title as string,
      levelId: currentLevel.id,
      minScore: currentLevel.score,
      maxScore: nextLevel ? nextLevel.score : null,
    };
  }

  findPrincipal(id: number) {
    return this.userRepository.findOne({
      select: { id: true, username: true },
      where: { id },
    });
  }

  findOneUsername(username: string) {
    // Exact legacy login first, then the canonical public handle. Existing
    // accounts that differed only in case keep their original credentials.
    return this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.password', 'u.public_identifier'])
      .where(
        'u.username = :exact OR lower(u.public_identifier) = :identifier',
        { exact: username.trim(), identifier: username.trim().toLowerCase() },
      )
      .orderBy('CASE WHEN u.username = :exact THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .getOne();
  }

  async updateScore(id: number, score: number) {
    throw new ForbiddenException({ code: 'SERVER_PROGRESSION', message: 'La progression est calculée à la fin des duels.' });
  }

  async incrementScore(id: number, points: number): Promise<void> {
    if (!Number.isInteger(id) || !Number.isInteger(points) || points <= 0) {
      throw new Error('A valid user ID and a positive integer are required');
    }

    const result = await this.userRepository
      .createQueryBuilder()
      .update(UserEntity)
      .set({ score: () => 'score + :points' })
      .where('id = :id', { id })
      .setParameters({ points })
      .execute();

    if (result.affected !== 1) {
      throw new Error(`User with ID ${id} not found`);
    }
  }

  async updateImageUrl(id: number, imageUrl: string): Promise<void> {
    await this.userRepository.update(id, { image_url: imageUrl });
  }

  remove(id: number) {
    return this.userRepository.delete({ id });
  }
}
