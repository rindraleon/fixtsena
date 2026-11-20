import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EscrowService } from './escrow.service';
import { BlockEscrowDto } from './dto/escrow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('escrow')
@Controller('escrow')
@ApiBearerAuth()
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('order/:orderId')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Statut du séquestre pour une commande' })
  async findByOrderId(
    @Param('orderId') orderId: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const escrow = await this.escrowService.findByOrderId(orderId, user.id, user.roles);
    return {
      success: true,
      message: 'Séquestre récupéré avec succès',
      data: escrow,
    };
  }

  @Get('payment/:paymentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Séquestre d\'un paiement (admin)' })
  async findByPaymentId(@Param('paymentId') paymentId: string) {
    const escrow = await this.escrowService.findByPaymentId(paymentId);
    return {
      success: true,
      message: 'Séquestre récupéré avec succès',
      data: escrow,
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des séquestres (admin)' })
  async getStats() {
    const stats = await this.escrowService.getStats();
    return {
      success: true,
      message: 'Statistiques escrow récupérées avec succès',
      data: stats,
    };
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Détail d\'un séquestre' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const escrow = await this.escrowService.findById(id, user.id, user.roles);
    return {
      success: true,
      message: 'Séquestre récupéré avec succès',
      data: escrow,
    };
  }

  @Post(':id/release')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Libérer les fonds du séquestre' })
  async releaseFunds(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const escrow = await this.escrowService.releaseFunds(id, user.id, user.roles);
    return {
      success: true,
      message: 'Fonds libérés avec succès vers le vendeur',
      data: escrow,
    };
  }

  @Post(':id/block')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bloquer les fonds du séquestre (litige)' })
  async blockFunds(
    @Param('id') id: string,
    @Body() dto: BlockEscrowDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const escrow = await this.escrowService.blockFunds(id, dto.reason, user.id, user.roles);
    return {
      success: true,
      message: 'Fonds bloqués avec succès',
      data: escrow,
    };
  }

  @Post(':id/unblock')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Débloquer les fonds après résolution de litige' })
  async unblockFunds(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const escrow = await this.escrowService.unblockFunds(id, user.id, user.roles);
    return {
      success: true,
      message: 'Fonds débloqués avec succès',
      data: escrow,
    };
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rembourser l\'acheteur' })
  async refundBuyer(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const escrow = await this.escrowService.refundBuyer(id, user.id, user.roles);
    return {
      success: true,
      message: 'Remboursement initié avec succès',
      data: escrow,
    };
  }
}
