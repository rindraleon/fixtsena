import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AirtelPaymentRequest {
  amount: number;
  phone: string;
  description: string;
  reference: string;
}

export interface AirtelPaymentResponse {
  transactionId: string;
  status: 'success' | 'pending' | 'failed';
  providerResponse?: string;
  paymentUrl?: string;
}

@Injectable()
export class AirtelMoneyProvider {
  private readonly logger = new Logger(AirtelMoneyProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly merchantId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('AIRTEL_API_URL', 'https://api.airtelmoney.mg');
    this.apiKey = this.configService.get<string>('AIRTEL_API_KEY', '');
    this.merchantId = this.configService.get<string>('AIRTEL_MERCHANT_ID', '');
  }

  validatePhone(phone: string): boolean {
    const regex = /^03[238]\d{7}$/;
    return regex.test(phone);
  }

  async initiatePayment(request: AirtelPaymentRequest): Promise<AirtelPaymentResponse> {
    if (!this.validatePhone(request.phone)) {
      throw new BadRequestException(
        'Numéro Airtel invalide. Format attendu : 032XXXXXXXXX, 033XXXXXXXXX ou 038XXXXXXXXX'
      );
    }

    if (request.amount < 100) {
      throw new BadRequestException('Le montant minimum pour Airtel Money est de 100 Ar');
    }

    if (request.amount > 10000000) {
      throw new BadRequestException('Le montant maximum pour Airtel Money est de 10 000 000 Ar');
    }

    this.logger.log(`[Airtel] Initiation paiement: ${request.amount} Ar depuis ${request.phone}`);

    const transactionId = `AIR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return {
      transactionId,
      status: 'pending',
      paymentUrl: `${this.apiUrl}/pay/${transactionId}`,
      providerResponse: JSON.stringify({
        provider: 'Airtel Money',
        phone: request.phone,
        amount: request.amount,
        reference: request.reference,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  async checkPaymentStatus(transactionId: string): Promise<AirtelPaymentResponse> {
    this.logger.log(`[Airtel] Vérification statut: ${transactionId}`);

    return {
      transactionId,
      status: 'pending',
      providerResponse: JSON.stringify({
        provider: 'Airtel Money',
        transactionId,
        checkedAt: new Date().toISOString(),
      }),
    };
  }

  async confirmPayment(transactionId: string): Promise<AirtelPaymentResponse> {
    this.logger.log(`[Airtel] Confirmation paiement: ${transactionId}`);

    return {
      transactionId,
      status: 'success',
      providerResponse: JSON.stringify({
        provider: 'Airtel Money',
        confirmed: true,
        confirmedAt: new Date().toISOString(),
      }),
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<AirtelPaymentResponse> {
    this.logger.log(`[Airtel] Remboursement: ${transactionId} — ${amount} Ar`);

    return {
      transactionId,
      status: 'success',
      providerResponse: JSON.stringify({
        provider: 'Airtel Money',
        refunded: true,
        amount,
        refundedAt: new Date().toISOString(),
      }),
    };
  }
}
