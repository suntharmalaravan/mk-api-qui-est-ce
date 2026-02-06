import {
  Get,
  Post,
  Put,
  Delete,
  Controller,
  UseGuards,
  Request,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageService } from './image.service';
import { FirebaseService } from '../firebase/firebase.service';

@Controller('api/images')
export class ImageController {
  constructor(
    private readonly imageService: ImageService,
    private readonly firebaseService: FirebaseService,
  ) { }

  // ========== CATEGORY ROUTES ==========

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async getCategories() {
    const categories = await this.imageService.getCategories();
    return categories;
  }

  // ========== DECK ROUTES ==========

  @Get('decks')
  @UseGuards(JwtAuthGuard)
  async getMyDecks(@Request() req) {
    const userId = req.user.id;
    const decks = await this.imageService.getDecks(userId);
    return { decks };
  }

  @Get('decks/:id')
  @UseGuards(JwtAuthGuard)
  async getDeckImages(
    @Request() req,
    @Param('id', ParseIntPipe) deckId: number,
  ) {
    const userId = req.user.id;
    const deck = await this.imageService.getDeck(deckId, userId);

    if (!deck) {
      throw new NotFoundException('Deck non trouvé');
    }

    const images = await this.imageService.getDeckImages(deckId, userId);
    return { deck, images };
  }

  @Post('decks')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 30))
  async createDeck(
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('names') namesJson: string,
    @Body('deckName') deckName?: string,
  ) {
    const userId = req.user.id;

    if (!files || files.length < 18) {
      throw new BadRequestException('Minimum 18 images requises pour créer un deck');
    }

    let names: string[];
    try {
      names = JSON.parse(namesJson);
    } catch (e) {
      throw new BadRequestException('Format des noms invalide');
    }

    if (names.length !== files.length) {
      throw new BadRequestException('Le nombre de noms doit correspondre au nombre d\'images');
    }

    // 1. Créer le deck d'abord pour avoir le deckId
    console.log('📦 Création du deck pour user:', userId);
    const deck = await this.imageService.createEmptyDeck(userId, deckName?.trim());
    console.log('✅ Deck créé:', { deckId: deck.id, name: deck.name });

    // 2. Upload vers Firebase avec le deckId dans le path
    const uploadedImages: { url: string; name: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = names[i];

      if (!name || name.trim().length < 2) {
        throw new BadRequestException(`Le nom de l'image ${i + 1} est invalide`);
      }

      console.log(`📤 Upload image ${i + 1}/${files.length} dans deck ${deck.id}`);
      const url = await this.firebaseService.uploadLibraryImage(
        userId,
        file.buffer,
        file.mimetype,
        `${Date.now()}-${i}`,
        deck.id, // Utiliser le deckId pour la structure de dossiers
      );

      uploadedImages.push({ url, name: name.trim() });
    }

    console.log('📸 Toutes les images uploadées, ajout en base');

    // 3. Ajouter les images au deck en base
    const savedImages = await this.imageService.addImagesToDeck(
      deck.id,
      userId,
      uploadedImages,
    );

    console.log('✅ Deck complet:', { deckId: deck.id, imageCount: savedImages.length });

    return {
      success: true,
      deck: deck,
      imageCount: savedImages.length,
    };
  }

  @Put('decks/:id')
  @UseGuards(JwtAuthGuard)
  async renameDeck(
    @Request() req,
    @Param('id', ParseIntPipe) deckId: number,
    @Body('name') name: string,
  ) {
    const userId = req.user.id;

    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Le nom doit contenir au moins 2 caractères');
    }

    const updated = await this.imageService.renameDeck(deckId, userId, name.trim());

    if (!updated) {
      throw new NotFoundException('Deck non trouvé');
    }

    return updated;
  }

  @Delete('decks/:id')
  @UseGuards(JwtAuthGuard)
  async deleteDeck(
    @Request() req,
    @Param('id', ParseIntPipe) deckId: number,
  ) {
    const userId = req.user.id;
    const deleted = await this.imageService.deleteDeck(deckId, userId);

    if (!deleted) {
      throw new NotFoundException('Deck non trouvé');
    }

    return { success: true };
  }

  @Post('decks/:id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  async addImagesToDeck(
    @Request() req,
    @Param('id', ParseIntPipe) deckId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('names') namesJson: string,
  ) {
    const userId = req.user.id;

    if (!files || files.length === 0) {
      throw new BadRequestException('Au moins une image est requise');
    }

    let names: string[];
    try {
      names = JSON.parse(namesJson);
    } catch (e) {
      throw new BadRequestException('Format des noms invalide');
    }

    if (names.length !== files.length) {
      throw new BadRequestException('Le nombre de noms doit correspondre au nombre d\'images');
    }

    // Vérifier que le deck existe et appartient à l'utilisateur
    const deck = await this.imageService.getDeck(deckId, userId);
    if (!deck) {
      throw new NotFoundException('Deck non trouvé');
    }

    // Upload vers Firebase
    const uploadedImages: { url: string; name: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = names[i];

      if (!name || name.trim().length < 2) {
        throw new BadRequestException(`Le nom de l'image ${i + 1} est invalide`);
      }

      console.log(`📤 Ajout image ${i + 1}/${files.length} au deck ${deckId}`);
      const url = await this.firebaseService.uploadLibraryImage(
        userId,
        file.buffer,
        file.mimetype,
        `${Date.now()}-${i}`,
        deckId,
      );

      uploadedImages.push({ url, name: name.trim() });
    }

    // Ajouter les images au deck
    const savedImages = await this.imageService.addImagesToDeck(
      deckId,
      userId,
      uploadedImages,
    );

    console.log('✅ Images ajoutées:', { deckId, imageCount: savedImages.length });

    return {
      success: true,
      addedCount: savedImages.length,
      images: savedImages,
    };
  }

  // ========== LEGACY CUSTOM LIBRARY ROUTES (backward compat) ==========

  @Post('custom/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 30))
  async uploadCustomImages(
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('names') namesJson: string,
  ) {
    const userId = req.user.id;

    if (!files || files.length === 0) {
      throw new BadRequestException('Aucune image fournie');
    }

    let names: string[];
    try {
      names = JSON.parse(namesJson);
    } catch (e) {
      throw new BadRequestException('Format des noms invalide');
    }

    if (names.length !== files.length) {
      throw new BadRequestException('Le nombre de noms doit correspondre au nombre d\'images');
    }

    const uploadedImages: { url: string; name: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = names[i];

      if (!name || name.trim().length < 2) {
        throw new BadRequestException(`Le nom de l'image ${i + 1} est invalide`);
      }

      const url = await this.firebaseService.uploadLibraryImage(
        userId,
        file.buffer,
        file.mimetype,
        `${Date.now()}-${i}`,
      );

      uploadedImages.push({ url, name: name.trim() });
    }

    // Créer un deck automatiquement
    const result = await this.imageService.createDeckWithImages(userId, null, uploadedImages);

    return {
      success: true,
      deckId: result.deck.id,
      deckName: result.deck.name,
      count: result.images.length,
      images: result.images,
    };
  }

  @Get('custom')
  @UseGuards(JwtAuthGuard)
  async getMyCustomImages(@Request() req) {
    const userId = req.user.id;
    const images = await this.imageService.findByUserId(userId);
    return {
      count: images.length,
      images,
    };
  }

  @Get('custom/count')
  @UseGuards(JwtAuthGuard)
  async getCustomImagesCount(@Request() req) {
    const userId = req.user.id;
    const count = await this.imageService.count(userId);
    return { count };
  }

  @Put('custom/:id/name')
  @UseGuards(JwtAuthGuard)
  async updateCustomImageName(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('name') name: string,
  ) {
    const userId = req.user.id;

    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Le nom doit contenir au moins 2 caractères');
    }

    const updated = await this.imageService.updateName(id, userId, name.trim());
    if (!updated) {
      throw new BadRequestException('Image non trouvée');
    }

    return updated;
  }

  @Delete('custom/:id')
  @UseGuards(JwtAuthGuard)
  async deleteCustomImage(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = req.user.id;
    const deleted = await this.imageService.remove(id, userId);

    if (!deleted) {
      throw new BadRequestException('Image non trouvée');
    }

    return { success: true };
  }

  @Delete('custom')
  @UseGuards(JwtAuthGuard)
  async deleteAllCustomImages(@Request() req) {
    const userId = req.user.id;
    await this.imageService.removeAllByUserId(userId);
    return { success: true };
  }
}
