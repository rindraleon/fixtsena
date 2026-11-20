import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MVolaPaymentRequest {
  amount: number;
  phone: string;
  description: string;
  reference: string;
}

export interface MVolaPaymentResponse {
  transactionId: string;
  status: 'success' | 'pending' | 'failed';
  providerResponse?: string;
  paymentUrl?: string;
}

@Injectable()
export class MVolaProvider {
  private readonly logger = new Logger(MVolaProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly merchantId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('MVOLA_API_URL', 'https://api.mvola.mg');
    this.apiKey = this.configService.get<string>('MVOLA_API_KEY', '');
    this.merchantId = this.configService.get<string>('MVOLA_MERCHANT_ID', '');
  }

  validatePhone(phone: string): boolean {
    const regex = /^034\d{8}$/;
    return regex.test(phone);
  }

  async initiatePayment(request: MVolaPaymentRequest): Promise<MVolaPaymentResponse> {
    if (!this.validatePhone(request.phone)) {
      throw new BadRequestException('Numéro MVola invalide. Format attendu : 034XXXXXXXXX');
    }

    if (request.amount < 100) {
      throw new BadRequestException('Le montant minimum pour MVola est de 100 Ar');
    }

    if (request.amount > 5000000) {
      throw new BadRequestException('Le montant maximum pour MVola est de 5 000 000 Ar');
    }

    this.logger.log(`[MVola] Initiation paiement: ${request.amount} Ar depuis ${request.phone}`);

    const transactionId = `MVL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return {
      transactionId,
      status: 'pending',
      paymentUrl: `${this.apiUrl}/pay/${transactionId}`,
      providerResponse: JSON.stringify({
        provider: 'MVola',
        phone: request.phone,
        amount: request.amount,
        reference: request.reference,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  async checkPaymentStatus(transactionId: string): Promise<MVolaPaymentResponse> {
    this.logger.log(`[MVola] Vérification statut: ${transactionId}`);

    return {
      transactionId,
      status: 'pending',
      providerResponse: JSON.stringify({
        provider: 'MVola',
        transactionId,
        checkedAt: new Date().toISOString(),
      }),
    };
  }

  async confirmPayment(transactionId: string): Promise<MVolaPaymentResponse> {
    this.logger.log(`[MVola] Confirmation paiement: ${transactionId}`);

    return {
      transactionId,
      status: 'success',
      providerResponse: JSON.stringify({
        provider: 'MVola',
        confirmed: true,
        confirmedAt: new Date().toISOString(),
      }),
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<MVolaPaymentResponse> {
    this.logger.log(`[MVola] Remboursement: ${transactionId} — ${amount} Ar`);

    return {
      transactionId,
      status: 'success',
      providerResponse: JSON.stringify({
        provider: 'MVola',
        refunded: true,
        amount,
        refundedAt: new Date().toISOString(),
      }),
    };
  }
}
