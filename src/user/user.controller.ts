import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UnauthorizedException,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateScoreDto } from './dto/update-score.dto';
import { FirebaseService } from 'src/firebase/firebase.service';
import { memoryStorage } from 'multer';

@Controller('api/users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly firebaseService: FirebaseService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id/scores')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateScore: UpdateScoreDto) {
    return this.userService.updateScore(+id, updateScore.score);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() request: any) {
    if (+id == request.user.id) {
      return this.userService.remove(+id);
    } else {
      throw new UnauthorizedException();
    }
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(), // Garde le fichier en mémoire pour Firebase
      fileFilter: (req, file, callback) => {
        // Accepter seulement les images
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException('Seules les images sont autorisées'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  async uploadProfileImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() request: any,
  ) {
    // Vérifier que l'utilisateur peut modifier ses propres images
    if (+id !== request.user.id) {
      throw new UnauthorizedException(
        'Vous ne pouvez modifier que votre propre image de profil',
      );
    }

    if (!file) {
      throw new BadRequestException('Aucune image fournie');
    }

    try {
      // Vérifier que l'utilisateur existe
      const user = await this.userService.findOne(+id);
      if (!user) {
        throw new BadRequestException('Utilisateur non trouvé');
      }

      console.log('📸 Upload image de profil:', {
        userId: id,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      // Upload vers Firebase Storage
      const imageUrl = await this.firebaseService.uploadProfileImage(
        +id,
        file.buffer,
        file.mimetype,
      );

      // Mettre à jour l'URL de l'image dans la base de données
      await this.userService.updateImageUrl(+id, imageUrl);

      console.log('✅ Image uploadée avec succès:', {
        userId: id,
        imageUrl: imageUrl,
      });

      return {
        success: true,
        message: 'Image de profil uploadée avec succès',
        imageUrl: imageUrl,
        userId: +id,
      };
    } catch (error) {
      console.error('❌ Erreur upload image:', error);
      throw new BadRequestException(
        error.message || "Erreur lors de l'upload de l'image",
      );
    }
  }
}
