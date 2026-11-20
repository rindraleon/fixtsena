import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from '../../database/entities/marketplace.entity';
import { SETTINGS_DEFAULTS, SETTINGS_GROUPS, SettingKey, SettingsMap } from './settings.defaults';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, unknown>();
  private loaded = false;

  constructor(
    @InjectRepository(PlatformSetting)
    private readonly repository: Repository<PlatformSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      const rows = await this.repository.find();
      this.cache = new Map(rows.map((row) => [row.key, row.value]));
      this.loaded = true;
    } catch (error) {
      this.logger.warn(`Paramètres non chargés (valeurs par défaut utilisées): ${(error as Error).message}`);
    }
  }

  get<K extends SettingKey>(key: K): SettingsMap[K] {
    if (this.cache.has(key)) return this.cache.get(key) as SettingsMap[K];
    return SETTINGS_DEFAULTS[key] as SettingsMap[K];
  }

  getAll(): { values: SettingsMap; defaults: SettingsMap; groups: typeof SETTINGS_GROUPS; overridden: SettingKey[] } {
    const values = {} as Record<string, unknown>;
    for (const key of Object.keys(SETTINGS_DEFAULTS) as SettingKey[]) values[key] = this.get(key);
    return {
      values: values as SettingsMap,
      defaults: SETTINGS_DEFAULTS as SettingsMap,
      groups: SETTINGS_GROUPS,
      overridden: [...this.cache.keys()].filter((key): key is SettingKey => key in SETTINGS_DEFAULTS),
    };
  }

  getPublic() {
    return {
      majorityAge: this.get('account.majorityAge'),
      helpEmail: this.get('notifications.helpEmail'),
      subscriptions: {
        gold: { monthlyPrice: this.get('subscriptions.gold.monthlyPrice'), yearlyPrice: this.get('subscriptions.gold.yearlyPrice') },
        premium: { monthlyPrice: this.get('subscriptions.premium.monthlyPrice'), yearlyPrice: this.get('subscriptions.premium.yearlyPrice') },
      },
      promotions: { offers: this.get('promotions.offers'), levelDiscounts: this.get('promotions.levelDiscounts') },
      levels: this.get('levels.thresholds'),
      messaging: { attachmentsAllowed: this.get('messaging.attachmentsAllowed'), maxMessageLength: this.get('messaging.maxMessageLength') },
      disputes: { openingWindowDays: this.get('disputes.openingWindowDays') },
      escrow: { autoReleaseDays: this.get('escrow.autoReleaseDays') },
      products: { moderationRequired: this.get('products.moderationRequired') },
    };
  }

  async update(patch: Record<string, unknown>, updatedBy: string): Promise<SettingsMap> {
    const entries = Object.entries(patch ?? {});
    if (entries.length === 0) throw new BadRequestException('Aucun paramètre à mettre à jour');
    for (const [key, value] of entries) {
      if (!(key in SETTINGS_DEFAULTS)) throw new BadRequestException(`Paramètre inconnu : ${key}`);
      this.assertCompatible(key as SettingKey, value);
    }
    for (const [key, value] of entries) {
      await this.repository.save(this.repository.create({ key, value, updatedBy }));
    }
    await this.reload();
    this.logger.log(`Paramètres mis à jour par ${updatedBy}: ${entries.map(([k]) => k).join(', ')}`);
    return this.getAll().values;
  }

  async reset(key: string): Promise<void> {
    if (!(key in SETTINGS_DEFAULTS)) throw new BadRequestException(`Paramètre inconnu : ${key}`);
    await this.repository.delete({ key });
    await this.reload();
  }

  private assertCompatible(key: SettingKey, value: unknown): void {
    const reference = SETTINGS_DEFAULTS[key];
    const expected = Array.isArray(reference) ? 'array' : typeof reference;
    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (expected !== actual) {
      throw new BadRequestException(`Valeur invalide pour « ${key} » : ${expected} attendu`);
    }
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
      throw new BadRequestException(`Valeur invalide pour « ${key} » : nombre positif attendu`);
    }
    if (key === 'commissions.refundPolicy' && !['full', 'none', 'partial'].includes(String(value))) {
      throw new BadRequestException('Politique de remboursement invalide (full, none ou partial)');
    }
    if (key === 'promotions.offers') {
      for (const offer of value as Array<Record<string, unknown>>) {
        if (!['boost', 'highlight', 'featured'].includes(String(offer?.type)) || !(Number(offer?.durationDays) > 0) || !(Number(offer?.price) >= 0)) {
          throw new BadRequestException('Offre de promotion invalide (type, durationDays > 0, price ≥ 0)');
        }
      }
    }
    if (key === 'levels.thresholds') {
      for (const level of ['verified', 'gold', 'premium']) {
        const threshold = (value as Record<string, Record<string, unknown>>)[level];
        if (!threshold || typeof threshold.minOrders !== 'number' || typeof threshold.minRating !== 'number') {
          throw new BadRequestException(`Seuils du niveau « ${level} » incomplets`);
        }
      }
    }
  }
}
