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
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une catégorie (admin)' })
  async create(@Body() dto: CreateCategoryDto) {
    const category = await this.categoriesService.create(dto);
    return {
      success: true,
      message: 'Catégorie créée avec succès',
      data: category,
    };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister toutes les catégories' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, description: 'Inclure les catégories inactives (admin)' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('parentId') parentId?: string,
    @Query('isActive') isActive?: boolean,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const result = await this.categoriesService.findAll({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      search,
      parentId,
      isActive: isActive !== undefined ? isActive : undefined,
      includeInactive: includeInactive === true,
    });

    return {
      success: true,
      message: 'Catégories récupérées avec succès',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('tree')
  @Public()
  @ApiOperation({ summary: 'Obtenir l\'arbre des catégories' })
  async getTree() {
    const tree = await this.categoriesService.getCategoryTree();
    return {
      success: true,
      message: 'Arborescence des catégories récupérée avec succès',
      data: tree,
    };
  }

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({ summary: 'Trouver une catégorie par ID ou slug' })
  async findByIdOrSlug(@Param('idOrSlug') idOrSlug: string) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const category = isUUID
      ? await this.categoriesService.findById(idOrSlug)
      : await this.categoriesService.findBySlug(idOrSlug);

    return {
      success: true,
      message: 'Catégorie récupérée avec succès',
      data: category,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour une catégorie (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const category = await this.categoriesService.update(id, dto);
    return {
      success: true,
      message: 'Catégorie mise à jour avec succès',
      data: category,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une catégorie (admin)' })
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
    return {
      success: true,
      message: 'Catégorie supprimée avec succès',
    };
  }
}
