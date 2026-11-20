import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto, AddEvidenceDto, ResolveDisputeDto,
  UpdateDisputeStatusDto, FilterDisputeDto } from './dto/dispute.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('disputes')
@Controller('disputes')
@ApiBearerAuth()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un litige' })
  async createDispute(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDisputeDto,
  ) {
    const dispute = await this.disputesService.createDispute(user.id, dto);
    return {
      success: true,
      message: 'Litige créé avec succès',
      data: dispute,
    };
  }

  @Post(':id/evidence')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ajouter une preuve au litige' })
  async addEvidence(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AddEvidenceDto,
  ) {
    const evidence = await this.disputesService.addEvidence(id, user.id, dto);
    return {
      success: true,
      message: 'Preuve ajoutée avec succès',
      data: evidence,
    };
  }

  @Post(':id/resolve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Résoudre un litige (admin)' })
  async resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: { id: string },
  ) {
    const dispute = await this.disputesService.resolveDispute(id, dto, user.id);
    return {
      success: true,
      message: `Litige résolu: ${dto.decision}`,
      data: dispute,
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Faire évoluer le dossier (ouvrir, analyser, demander des informations, clôturer, annuler)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const dispute = await this.disputesService.updateStatus(id, dto, user.id, user.roles);
    return { success: true, message: 'Litige mis à jour', data: dispute };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des litiges (admin)' })
  async getStats() {
    const stats = await this.disputesService.getStats();
    return {
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats,
    };
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Détail d\'un litige' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const dispute = await this.disputesService.findByIdForUser(id, user.id, user.roles);
    return {
      success: true,
      message: 'Litige récupéré avec succès',
      data: dispute,
    };
  }

  @Get(':id/evidence')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Preuves d\'un litige' })
  async getEvidence(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const evidence = await this.disputesService.getEvidence(id, user.id, user.roles);
    return {
      success: true,
      message: 'Preuves récupérées avec succès',
      data: evidence,
    };
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister les litiges' })
  async findAll(
    @Query() filters: FilterDisputeDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const result = await this.disputesService.findAll(filters, user.id, user.roles);
    return {
      success: true,
      message: 'Litiges récupérés avec succès',
      data: result.items,
      meta: result.meta,
    };
  }
}
