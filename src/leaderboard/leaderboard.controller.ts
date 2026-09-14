import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('api/leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  allTime(
    @Request() request: { user: { id: number } },
    @Query('scope') scope?: string,
  ) {
    return this.leaderboard.getAllTime(Number(request.user.id), scope);
  }

  /** `?date=YYYY-MM-DD`, defaults to today (Paris time). */
  @Get('daily')
  daily(
    @Request() request: { user: { id: number } },
    @Query('date') date?: string,
  ) {
    return this.leaderboard.getDaily(Number(request.user.id), date);
  }
}
