import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BadgesService } from './badges.service';
import { CreateBadgeDto, UpdateBadgeDto, AwardBadgeDto } from './dto/badge.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../database/entities/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('badges')
@Controller('badges')
@ApiBearerAuth()
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un badge (admin)' })
  async createBadge(@Body() dto: CreateBadgeDto) {
    const badge = await this.badgesService.createBadge(dto);
    return {
      success: true,
      message: 'Badge créé avec succès',
      data: badge,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un badge (admin)' })
  async updateBadge(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
    const badge = await this.badgesService.updateBadge(id, dto);
    return {
      success: true,
      message: 'Badge mis à jour avec succès',
      data: badge,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un badge (admin)' })
  async removeBadge(@Param('id') id: string) {
    await this.badgesService.removeBadge(id);
    return {
      success: true,
      message: 'Badge supprimé avec succès',
    };
  }

  @Post('award')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Attribuer un badge à un utilisateur (admin)' })
  async awardBadge(
    @Body() body: { userId: string; badgeId: string } & AwardBadgeDto,
    @CurrentUser() admin: { id: string },
  ) {
    const { userId, badgeId, ...rest } = body;
    const result = await this.badgesService.awardBadge(userId, badgeId, rest, { source: 'manual', awardedBy: admin.id });
    return {
      success: true,
      message: 'Badge attribué avec succès',
      data: result,
    };
  }

  @Delete('award/:userId/:badgeId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer un badge d\'un utilisateur (admin)' })
  async removeBadgeFromUser(
    @Param('userId') userId: string,
    @Param('badgeId') badgeId: string,
  ) {
    await this.badgesService.removeBadgeFromUser(userId, badgeId);
    return {
      success: true,
      message: 'Badge retiré avec succès',
    };
  }

  @Post('evaluate/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Réévaluer les badges automatiques d’un utilisateur (admin)' })
  async evaluateUser(@Param('userId') userId: string) {
    const [stats, result] = [await this.badgesService.collectStats(userId), await this.badgesService.evaluateUser(userId)];
    return { success: true, message: 'Badges réévalués', data: { ...result, stats } };
  }

  @Post('seed-defaults')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer les badges par défaut du cahier des charges (idempotent)' })
  async seedDefaults() {
    const created = await this.badgesService.ensureDefaults();
    return { success: true, message: created > 0 ? `${created} badge(s) créé(s)` : 'Les badges par défaut existent déjà', data: { created } };
  }

  @Get('user/:userId/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Indicateurs utilisés pour les critères de badges (admin)' })
  async userStats(@Param('userId') userId: string) {
    const data = await this.badgesService.collectStats(userId);
    return { success: true, message: 'Indicateurs', data };
  }

  @Get('user/:userId')
  @Public()
  @ApiOperation({ summary: 'Badges d\'un utilisateur' })
  async getUserBadges(@Param('userId') userId: string) {
    const badges = await this.badgesService.getUserBadges(userId);
    return {
      success: true,
      message: 'Badges récupérés avec succès',
      data: badges,
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des badges (admin)' })
  async getStats() {
    const stats = await this.badgesService.getStats();
    return {
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats,
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Détail d\'un badge' })
  async findById(@Param('id') id: string) {
    const badge = await this.badgesService.findById(id);
    return {
      success: true,
      message: 'Badge récupéré avec succès',
      data: badge,
    };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les badges' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async findAll(@Query('includeInactive') includeInactive?: boolean) {
    const badges = await this.badgesService.findAll(includeInactive === true);
    return {
      success: true,
      message: 'Badges récupérés avec succès',
      data: badges,
    };
  }
}
