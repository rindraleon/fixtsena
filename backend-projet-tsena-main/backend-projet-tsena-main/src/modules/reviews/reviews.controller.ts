import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, FilterReviewDto, SellerReplyDto, ReportReviewDto, ModerateReviewDto } from './dto/review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('reviews')
@Controller('reviews')
@ApiBearerAuth()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un avis' })
  async createReview(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateReviewDto,
  ) {
    const review = await this.reviewsService.createReview(user.id, dto);
    return {
      success: true,
      message: 'Avis créé avec succès',
      data: review,
    };
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un avis' })
  async updateReview(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const review = await this.reviewsService.updateReview(id, dto, user.id, user.roles);
    return {
      success: true,
      message: 'Avis mis à jour avec succès',
      data: review,
    };
  }

  @Post(':id/reply')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Réponse publique du vendeur à un avis (une seule, définitive)' })
  async reply(
    @Param('id') id: string,
    @Body() dto: SellerReplyDto,
    @CurrentUser() user: { id: string },
  ) {
    const review = await this.reviewsService.reply(id, user.id, dto);
    return {
      success: true,
      message: 'Réponse publiée',
      data: review,
    };
  }

  @Post(':id/report')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Signaler un avis à la modération' })
  async report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.reviewsService.report(id, user.id, dto);
    return {
      success: true,
      message: 'Avis signalé : notre équipe va l\'examiner',
    };
  }

  @Patch(':id/moderate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modération admin : masquer ou rétablir un avis (audité)' })
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: { id: string },
  ) {
    const review = await this.reviewsService.moderate(id, user.id, dto);
    return {
      success: true,
      message: dto.isVisible ? 'Avis rétabli' : 'Avis masqué',
      data: review,
    };
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un avis (masquer)' })
  async removeReview(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    await this.reviewsService.removeReview(id, user.id, user.roles);
    return {
      success: true,
      message: 'Avis masqué avec succès',
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des avis (admin)' })
  async getStats() {
    const stats = await this.reviewsService.getStats();
    return {
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats,
    };
  }

  @Get('user/:userId/average')
  @Public()
  @ApiOperation({ summary: 'Note moyenne d\'un utilisateur' })
  async getAverageRating(@Param('userId') userId: string) {
    const result = await this.reviewsService.getAverageRating(userId);
    return {
      success: true,
      message: 'Note moyenne récupérée',
      data: result,
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Détail d\'un avis' })
  async findById(@Param('id') id: string) {
    const review = await this.reviewsService.findById(id);
    return {
      success: true,
      message: 'Avis récupéré avec succès',
      data: review,
    };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les avis' })
  async findAll(@Query() filters: FilterReviewDto, @CurrentUser() user?: { id: string; roles: UserRole[] }) {
    const result = await this.reviewsService.findAll(filters, user?.roles ?? []);
    return {
      success: true,
      message: 'Avis récupérés avec succès',
      data: result.items,
      meta: result.meta,
    };
  }
}
