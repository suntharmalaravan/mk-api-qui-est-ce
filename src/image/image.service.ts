import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image as ImageEntity } from './entities/image.entity';
@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(ImageEntity)
    private readonly imageRepository: Repository<ImageEntity>,
  ) {}
  async getUrlsByCategory(category: string) {
    return await this.imageRepository.find({
      select: { id: true, name: true, url: true },
      where: { category },
    });
  }

  async getUrlById(id: number) {
    return await this.imageRepository.findOne({
      select: { url: true, name: true },
      where: { id },
    });
  }

  async getCategories() {
    const categories = await this.imageRepository
      .createQueryBuilder('image')
      .select('category')
      .distinct(true)
      .getRawMany();
    return categories;
  }
}
