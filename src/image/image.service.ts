import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Image as ImageEntity } from './entities/image.entity';
import { Deck } from './entities/deck.entity';

@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(ImageEntity)
    private readonly imageRepository: Repository<ImageEntity>,
    @InjectRepository(Deck)
    private readonly deckRepository: Repository<Deck>,
  ) { }

  // ========== CATEGORY IMAGES (admin-managed) ==========

  async getUrlsByCategory(category: string) {
    return await this.imageRepository.find({
      select: { id: true, name: true, url: true },
      where: { category, user_id: IsNull() },
    });
  }

  async getUrlById(id: number) {
    return await this.imageRepository.findOne({
      select: { url: true, name: true },
      where: { id },
    });
  }

  async getCategories() {
    // 1. Récupérer les noms des catégories distinctes
    const categoriesRaw = await this.imageRepository
      .createQueryBuilder('image')
      .select('category')
      .where('user_id IS NULL')
      .distinct(true)
      .getRawMany();

    const categoryNames = categoriesRaw.map(c => c.category);

    // 2. Pour chaque catégorie, récupérer 3 images pour la preview
    const categoriesWithImages = await Promise.all(
      categoryNames.map(async (categoryName) => {
        const images = await this.imageRepository.find({
          where: { category: categoryName, user_id: IsNull() },
          take: 3,
          select: { id: true, url: true, name: true },
        });

        return {
          category: categoryName,
          previewImages: images,
        };
      })
    );

    return categoriesWithImages;
  }

  /**
   * Crée un deck vide (pour obtenir le deckId avant l'upload)
   */
  async createEmptyDeck(userId: number, deckName?: string | null): Promise<Deck> {
    const name = deckName || await this.generateDeckName(userId);

    const deck = this.deckRepository.create({
      user_id: userId,
      name,
    });
    return await this.deckRepository.save(deck);
  }

  /**
   * Ajoute des images à un deck existant
   */
  async addImagesToDeck(
    deckId: number,
    userId: number,
    images: { url: string; name: string }[]
  ): Promise<ImageEntity[]> {
    const deckImages = images.map((img) =>
      this.imageRepository.create({
        user_id: userId,
        deck_id: deckId,
        url: img.url,
        name: img.name,
        category: null,
      }),
    );
    return await this.imageRepository.save(deckImages);
  }

  /**
   * Crée un deck avec des images (méthode legacy)
   */
  async createDeckWithImages(
    userId: number,
    deckName: string | null,
    images: { url: string; name: string }[]
  ): Promise<{ deck: Deck; images: ImageEntity[] }> {
    const deck = await this.createEmptyDeck(userId, deckName);
    const savedImages = await this.addImagesToDeck(deck.id, userId, images);
    return { deck, images: savedImages };
  }

  /**
   * Génère le prochain nom de deck (Deck 1, Deck 2, etc.)
   */
  async generateDeckName(userId: number): Promise<string> {
    const existingDecks = await this.deckRepository.find({
      where: { user_id: userId },
      select: { name: true },
    });

    // Trouver le plus grand numéro existant
    let maxNumber = 0;
    for (const deck of existingDecks) {
      const match = deck.name.match(/^Deck (\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    return `Deck ${maxNumber + 1}`;
  }

  /**
   * Récupère tous les decks d'un utilisateur
   */
  async getDecks(userId: number): Promise<(Deck & { imageCount: number })[]> {
    const decks = await this.deckRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    // Ajouter le nombre d'images et un aperçu pour chaque deck
    const decksWithCount = await Promise.all(
      decks.map(async (deck) => {
        const imageCount = await this.imageRepository.count({
          where: { deck_id: deck.id },
        });

        // Récupérer 4 images pour l'aperçu collage
        const previewImages = await this.imageRepository.find({
          where: { deck_id: deck.id },
          take: 4,
          select: { id: true, url: true, name: true },
        });

        return { ...deck, imageCount, previewImages };
      }),
    );

    return decksWithCount;
  }

  /**
   * Récupère un deck par ID avec vérification de propriété
   */
  async getDeck(deckId: number, userId: number): Promise<Deck | null> {
    return await this.deckRepository.findOne({
      where: { id: deckId, user_id: userId },
    });
  }

  /**
   * Récupère les images d'un deck
   */
  async getDeckImages(deckId: number, userId: number): Promise<ImageEntity[]> {
    // Vérifier que le deck appartient à l'utilisateur
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, user_id: userId },
    });

    if (!deck) {
      return [];
    }

    return await this.imageRepository.find({
      where: { deck_id: deckId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Récupère les images d'un deck par ID (sans vérification user)
   * Pour usage interne (ex: RoomGateway)
   */
  async getDeckImagesById(deckId: number): Promise<ImageEntity[]> {
    return await this.imageRepository.find({
      where: { deck_id: deckId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Supprime un deck et toutes ses images (cascade)
   */
  async deleteDeck(deckId: number, userId: number): Promise<boolean> {
    const result = await this.deckRepository.delete({
      id: deckId,
      user_id: userId,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Renomme un deck
   */
  async renameDeck(deckId: number, userId: number, newName: string): Promise<Deck | null> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, user_id: userId },
    });

    if (!deck) {
      return null;
    }

    deck.name = newName;
    return await this.deckRepository.save(deck);
  }

  // ========== LEGACY CUSTOM IMAGES (backward compat) ==========

  async createBulk(userId: number, images: { url: string; name: string }[]): Promise<ImageEntity[]> {
    const userImages = images.map((img) =>
      this.imageRepository.create({
        user_id: userId,
        url: img.url,
        name: img.name,
        category: null,
      }),
    );
    return await this.imageRepository.save(userImages);
  }

  async findByUserId(userId: number): Promise<ImageEntity[]> {
    return await this.imageRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async count(userId: number): Promise<number> {
    return await this.imageRepository.count({
      where: { user_id: userId },
    });
  }

  async countDeckImages(deckId: number): Promise<number> {
    return await this.imageRepository.count({
      where: { deck_id: deckId },
    });
  }

  async updateName(id: number, userId: number, name: string): Promise<ImageEntity | null> {
    const image = await this.imageRepository.findOne({
      where: { id, user_id: userId },
    });

    if (!image) {
      return null;
    }

    image.name = name;
    return await this.imageRepository.save(image);
  }

  async remove(id: number, userId: number): Promise<boolean> {
    const result = await this.imageRepository.delete({ id, user_id: userId });
    return (result.affected ?? 0) > 0;
  }

  async removeAllByUserId(userId: number): Promise<void> {
    await this.imageRepository.delete({ user_id: userId });
  }
}
