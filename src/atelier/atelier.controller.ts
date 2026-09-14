import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FirebaseService } from '../firebase/firebase.service';
import { createHash } from 'crypto';
// Sharp exposes a CommonJS function; allowSyntheticDefaultImports does not
// create a runtime default export with this project's compiler settings.
const sharp: typeof import('sharp').default = require('sharp');
import { MixedPhoto, parseMixedManifest } from './mixed-deck';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AtelierService } from './atelier.service';
import {
  CharacterDto,
  DeleteCharacterDto,
  PublishDto,
  PurchaseDto,
} from './atelier.dto';

@Controller('api/atelier')
export class AtelierController {
  constructor(private readonly atelier: AtelierService, private readonly firebase: FirebaseService) {}
  @Get('catalog')
  @UseGuards(JwtAuthGuard)
  catalog() {
    return this.atelier.catalog();
  }
  @Get('account')
  @UseGuards(JwtAuthGuard)
  account(@Request() req) {
    return this.atelier.account(req.user.id);
  }
  @Get('characters')
  @UseGuards(JwtAuthGuard)
  list(@Request() req) {
    return this.atelier.list(req.user.id);
  }
  @Post('characters')
  @UseGuards(JwtAuthGuard)
  save(@Request() req, @Body() body: CharacterDto) {
    return this.atelier.save(req.user.id, body);
  }
  @Delete('characters/:id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Request() req,
    @Param('id') id: string,
    @Body() body: DeleteCharacterDto,
  ) {
    return this.atelier.remove(req.user.id, id, body);
  }
  @Post('purchases')
  @UseGuards(JwtAuthGuard)
  purchase(@Request() req, @Body() body: PurchaseDto) {
    return this.atelier.purchase(req.user.id, body);
  }
  @Post('decks')
  @UseGuards(JwtAuthGuard)
  publish(@Request() req, @Body() body: PublishDto) {
    return this.atelier.publish(req.user.id, body);
  }
  @Post('mixed-decks')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 21, { limits: { fileSize: 5 * 1024 * 1024, files: 21, fields: 2, fieldSize: 32768, parts: 23 } }))
  async mixedDeck(@Request() req, @UploadedFiles() files: Express.Multer.File[], @Body('manifest') raw: string) {
    this.atelier.requireEnabled();
    const manifest = parseMixedManifest(raw, files?.length ?? 0);
    if ((files ?? []).reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024)
      throw new BadRequestException('Les photos du deck dépassent 25 Mo.');
    // Decode and strip metadata before storing. Content-addressed objects make
    // retries safe; the transaction publishes the entire board and its receipt.
    const photos: MixedPhoto[] = [];
    for (let index = 0; index < (files?.length ?? 0); index++) {
      let jpeg: Buffer;
      try {
        const decoder = sharp(files[index].buffer, { limitInputPixels: 25000000, animated: false });
        const metadata = await decoder.metadata();
        if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(metadata.format)) throw new Error('Unsupported photo');
        jpeg = await decoder.rotate().resize(800, 1000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      } catch { throw new BadRequestException('Une photo est illisible ou trop grande.'); }
      const hash = createHash('sha256').update(jpeg).digest('hex');
      const card = manifest.cards.find(c => c.kind === 'photo' && c.index === index);
      const url = await this.firebase.uploadLibraryImage(req.user.id, jpeg, 'image/jpeg', `mixed-${hash}`);
      photos.push({ url, hash, name: card && card.kind === 'photo' ? card.name.trim() : '' });
    }
    const characters = manifest.cards.filter((c): c is Extract<typeof c, { kind: 'character' }> => c.kind === 'character').map(({ id, revision }) => ({ id, revision }));
    return this.atelier.publish(req.user.id, { operationId: manifest.operationId, characters }, { photos, order: manifest.cards });
  }
  @Get('operations/:id')
  @UseGuards(JwtAuthGuard)
  operation(@Request() req, @Param('id') id: string) {
    return this.atelier.operation(req.user.id, id);
  }
  @Post('operations/:id/settle-deck')
  @UseGuards(JwtAuthGuard)
  settleDeck(@Request() req, @Param('id') id: string) {
    return this.atelier.settleDeck(req.user.id, id);
  }
  // Public generated art only. No uploaded user photo, name, ownership or recipe metadata.
  // These immutable URLs remain valid in existing game rooms after a character is edited.
  @Get('portraits/:hash')
  async portrait(@Param('hash') key: string, @Res() response: Response) {
    const bytes = await this.atelier.portrait(key);
    response
      .set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  }
}
