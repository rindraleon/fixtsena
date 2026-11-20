import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { Shop } from '../../database/entities/marketplace.entity';
import { Delivery, Escrow, Order } from '../../database/entities/transaction.entity';
import { DeliveryStatus, OrderStatus, ShopStatus } from '../../database/entities/role.enum';
import { ShopsService } from '../shops/shops.service';
import { PromotionsService } from '../promotions/promotions.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { BadgesService } from '../badges/badges.service';

export interface MaintenanceReport {
  startedAt: string;
  durationMs: number;
  shopsRefreshed: number;
  promotionsExpired: boolean;
  escrowAutoReleased: number;
  badgesUpdatedUsers: number;
  errors: string[];
}

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastReport: MaintenanceReport | null = null;

  constructor(
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Delivery) private readonly deliveryRepository: Repository<Delivery>,
    @InjectRepository(Escrow) private readonly escrowRepository: Repository<Escrow>,
    private readonly shops: ShopsService,
    private readonly orders: OrdersService,
    @Optional() private readonly promotions?: PromotionsService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly badges?: BadgesService,
  ) {}

  onModuleInit(): void {
    if (process.env.MAINTENANCE_DISABLED === 'true' || process.env.NODE_ENV === 'test') return;
    const minutes = Math.max(5, Number(this.settings?.get('maintenance.intervalMinutes') ?? 60) || 60);
    const first = setTimeout(() => void this.run('startup'), 20_000);
    first.unref();
    this.timer = setInterval(() => void this.run('interval'), minutes * 60_000);
    this.timer.unref();
    this.logger.log(`Tâches planifiées actives (toutes les ${minutes} min)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getLastReport(): MaintenanceReport | null {
    return this.lastReport;
  }

  async run(trigger: 'startup' | 'interval' | 'manual' = 'manual'): Promise<MaintenanceReport> {
    if (this.running && trigger !== 'manual') return this.lastReport ?? this.emptyReport();
    this.running = true;
    const startedAt = new Date();
    const report: MaintenanceReport = { ...this.emptyReport(), startedAt: startedAt.toISOString() };
    try {
      report.shopsRefreshed = await this.refreshShops(report.errors);
      report.promotionsExpired = await this.expirePromotions(report.errors);
      report.escrowAutoReleased = await this.autoReleaseEscrows(report.errors);
      report.badgesUpdatedUsers = await this.evaluateBadges(report.errors);
    } finally {
      report.durationMs = Date.now() - startedAt.getTime();
      this.lastReport = report;
      this.running = false;
      this.logger.log(
        `Maintenance (${trigger}) : ${report.shopsRefreshed} boutique(s) rafraîchie(s), ${report.escrowAutoReleased} réception(s) auto-validée(s), ${report.errors.length} erreur(s) en ${report.durationMs} ms`,
      );
    }
    return report;
  }

  private async refreshShops(errors: string[]): Promise<number> {
    let count = 0;
    try {
      const shops = await this.shopRepository.find({ where: { status: In([ShopStatus.ACTIVE, ShopStatus.PENDING_VERIFICATION]) } });
      for (const shop of shops) {
        try {
          await this.shops.refreshLevel(shop);
          count += 1;
        } catch (error) {
          errors.push(`boutique ${shop.id} : ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errors.push(`boutiques : ${(error as Error).message}`);
    }
    return count;
  }

  private async expirePromotions(errors: string[]): Promise<boolean> {
    if (!this.promotions) return false;
    try {
      await this.promotions.expireStale();
      return true;
    } catch (error) {
      errors.push(`promotions : ${(error as Error).message}`);
      return false;
    }
  }

  private async autoReleaseEscrows(errors: string[]): Promise<number> {
    const days = Number(this.settings?.get('escrow.autoReleaseDays') ?? 0) || 0;
    if (days <= 0) return 0;
    const threshold = new Date(Date.now() - days * 86_400_000);
    let released = 0;
    try {
      const deliveries = await this.deliveryRepository.find({
        where: { status: DeliveryStatus.DELIVERED, deliveredAt: LessThan(threshold), receptionConfirmedAt: IsNull() },
        take: 200,
      });
      for (const delivery of deliveries) {
        try {
          const order = await this.orderRepository.findOne({ where: { id: delivery.orderId, status: OrderStatus.SHIPPED } });
          if (!order) continue;
          const escrow = await this.escrowRepository.findOne({ where: { orderId: order.id } });
          if (escrow?.isBlocked) continue;
          const done = await this.orders.autoConfirmReception(
            order.id,
            `Réception validée automatiquement : aucune confirmation ni réclamation ${days} jour(s) après la remise du colis`,
          );
          if (done) released += 1;
        } catch (error) {
          errors.push(`commande ${delivery.orderId} : ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errors.push(`séquestre : ${(error as Error).message}`);
    }
    return released;
  }

  private async evaluateBadges(errors: string[]): Promise<number> {
    if (!this.badges) return 0;
    try {
      return await this.badges.evaluateAll();
    } catch (error) {
      errors.push(`badges : ${(error as Error).message}`);
      return 0;
    }
  }

  private emptyReport(): MaintenanceReport {
    return { startedAt: new Date().toISOString(), durationMs: 0, shopsRefreshed: 0, promotionsExpired: false, escrowAutoReleased: 0, badgesUpdatedUsers: 0, errors: [] };
  }
}
