import { Get, Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageService } from './image.service';

@Controller('api/images')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async getCategorie() {
    const categories = await this.imageService.getCategories();
    return categories;
  }
}
