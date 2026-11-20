import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { verifyWebhookSignature } from './webhook-signature';
import { InitiatePaymentDto, PaymentCallbackDto, FilterPaymentDto } from './dto/payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('payments')
@Controller('payments')
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Initier un paiement' })
  async initiatePayment(
    @CurrentUser() user: { id: string },
    @Body() dto: InitiatePaymentDto,
  ) {
    const result = await this.paymentsService.initiatePayment(user.id, dto);
    return {
      success: true,
      message: 'Paiement initié avec succès',
      data: result,
    };
  }

  @Post('callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback du provider de paiement (webhook signé HMAC-SHA256)' })
  async paymentCallback(
    @Body() dto: PaymentCallbackDto,
    @Headers('x-tsena-signature') signature?: string,
    @Headers('x-tsena-timestamp') timestamp?: string,
  ) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      if (process.env.PAYMENT_WEBHOOK_ALLOW_UNSIGNED !== 'true' || process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Les notifications de paiement ne sont pas configurées (PAYMENT_WEBHOOK_SECRET manquant)');
      }
    } else {
      const check = verifyWebhookSignature({ secret, signature, timestamp, transactionId: dto.transactionId, status: dto.status });
      if (!check.ok) {
        throw new UnauthorizedException(`Notification de paiement rejetée : ${check.reason}`);
      }
    }
    const payment = await this.paymentsService.handlePaymentCallback(dto);
    return {
      success: true,
      message: 'Callback traité avec succès',
      data: payment,
    };
  }

  @Post(':id/simulate-success')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Simuler le succès d\'un paiement (admin/test)' })
  async simulateSuccess(@Param('id') id: string) {
    const payment = await this.paymentsService.simulatePaymentSuccess(id);
    return {
      success: true,
      message: 'Paiement simulé avec succès',
      data: payment,
    };
  }

  @Post(':id/confirm')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirmer manuellement un paiement (admin)' })
  async confirmPayment(@Param('id') id: string) {
    const payment = await this.paymentsService.confirmPayment(id);
    return {
      success: true,
      message: 'Paiement confirmé avec succès',
      data: payment,
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des paiements (admin)' })
  async getStats() {
    const stats = await this.paymentsService.getStats();
    return {
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats,
    };
  }

  @Get('order/:orderId')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Paiements d\'une commande' })
  async findByOrderId(
    @Param('orderId') orderId: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const payments = await this.paymentsService.findByOrderId(orderId, user);
    return {
      success: true,
      message: 'Paiements récupérés avec succès',
      data: payments,
    };
  }

  @Get('transaction/:transactionId')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Paiement par ID de transaction' })
  async findByTransactionId(
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const payment = await this.paymentsService.findByTransactionId(transactionId, user);
    return {
      success: true,
      message: 'Paiement récupéré avec succès',
      data: payment,
    };
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Détail d\'un paiement' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const payment = await this.paymentsService.findById(id, user);
    return {
      success: true,
      message: 'Paiement récupéré avec succès',
      data: payment,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister les paiements (admin)' })
  async findAll(@Query() filters: FilterPaymentDto) {
    const result = await this.paymentsService.findAll(filters);
    return {
      success: true,
      message: 'Paiements récupérés avec succès',
      data: result.items,
      meta: result.meta,
    };
  }
}
