import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressionService } from './progression.service';

@Controller('api/progression')
@UseGuards(JwtAuthGuard)
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get('me')
  me(@Request() request: { user: { id: number } }) {
    return this.progression.getForUser(Number(request.user.id));
  }
}
