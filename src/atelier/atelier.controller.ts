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
} from '@nestjs/common';
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
  constructor(private readonly atelier: AtelierService) {}
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
  @Get('operations/:id')
  @UseGuards(JwtAuthGuard)
  operation(@Request() req, @Param('id') id: string) {
    return this.atelier.operation(req.user.id, id);
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
