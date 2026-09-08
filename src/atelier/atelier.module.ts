import { Module } from '@nestjs/common';
import { AtelierController } from './atelier.controller';
import { AtelierService } from './atelier.service';
import { PortraitService } from './portrait.service';
import { AtelierGameService } from './atelier-game.service';
@Module({
  controllers: [AtelierController],
  providers: [AtelierService, PortraitService, AtelierGameService],
  exports: [AtelierService, AtelierGameService],
})
export class AtelierModule {}
