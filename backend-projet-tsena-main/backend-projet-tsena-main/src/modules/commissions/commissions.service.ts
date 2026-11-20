import { BadRequestException, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CommissionRate, DeliveryZone, Shop } from '../../database/entities/marketplace.entity';
import { Category } from '../../database/entities/catalog.entity';
import { CommissionTier, ShopLevel } from '../../database/entities/role.enum';
import { SettingsService } from '../settings/settings.service';

export const COMMISSION_TIER_LABELS: Record<CommissionTier, string> = {
  [CommissionTier.NEW]: 'Nouveau',
  [CommissionTier.VERIFIED]: 'Vérifié',
  [CommissionTier.BIG_SELLER]: 'Gros vendeur',
};

export const DEFAULT_COMMISSION_GRID: Array<{ category: string; aliases: string[]; rates: [number, number, number] }> = [
  { category: 'Téléphone', aliases: ['telephone', 'telephones', 'smartphone', 'smartphones', 'telephonie'], rates: [6, 5, 4] },
  { category: 'Informatique', aliases: ['informatique', 'ordinateur', 'ordinateurs', 'high-tech', 'electronique'], rates: [7, 6, 5] },
  { category: 'Mode', aliases: ['mode', 'vetements', 'vetement', 'chaussures', 'accessoires'], rates: [10, 9, 8] },
  { category: 'Maison & déco', aliases: ['maison', 'maison-deco', 'maison-et-deco', 'decoration', 'artisanat'], rates: [9, 8, 7] },
  { category: 'Auto & moto', aliases: ['auto', 'moto', 'auto-moto', 'auto-et-moto', 'vehicules'], rates: [6, 5, 4] },
  { category: 'Jeux & loisirs', aliases: ['jeux', 'loisirs', 'jeux-loisirs', 'jeux-et-loisirs', 'sport'], rates: [9, 8, 7] },
  { category: 'Livres & fournitures', aliases: ['livres', 'fournitures', 'livres-fournitures', 'papeterie'], rates: [8, 7, 6] },
  { category: 'Alimentation', aliases: ['alimentation', 'epicerie', 'alimentaire', 'produits-alimentaires'], rates: [6, 5, 4] },
  { category: 'Beauté & cosmétiques', aliases: ['beaute', 'cosmetiques', 'beaute-cosmetiques', 'beaute-et-cosmetiques', 'beaute-sante'], rates: [10, 9, 8] },
  { category: 'Matériel & outils', aliases: ['materiel', 'outils', 'materiel-outils', 'bricolage'], rates: [7, 6, 5] },
  { category: 'Bijoux & montres', aliases: ['bijoux', 'montres', 'bijoux-montres'], rates: [10, 9, 8] },
  { category: 'Bébé & enfants', aliases: ['bebe', 'enfants', 'bebe-enfants', 'puericulture'], rates: [10, 9, 8] },
  { category: 'Électroménager', aliases: ['electromenager'], rates: [7, 6, 5] },
  { category: 'Agriculture', aliases: ['agriculture', 'agricole', 'jardin'], rates: [6, 5, 4] },
];

export const DEFAULT_DELIVERY_ZONES: Array<{ name: string; description: string; price: number }> = [
  { name: 'Centre-ville', description: 'Antananarivo centre (Analakely, Isoraka, Antaninarenina…)', price: 3_000 },
  { name: 'Périphérique', description: 'Première couronne (Ankorondrano, Ivandry, Ambohimanarina…)', price: 4_000 },
  { name: 'Périphérique +', description: 'Deuxième couronne (Talatamaty, Ambohidratrimo, Tanjombato…)', price: 5_000 },
  { name: 'Périphérique ++', description: 'Grande banlieue (Ivato, Ambatolampy-Tsimahafotsy, Alasora…)', price: 6_000 },
  { name: 'Périphérique +++', description: 'Zones éloignées de l\'agglomération', price: 7_000 },
];

export interface CommissionQuote {
  tier: CommissionTier;
  tierLabel: string;
  ratePercent: number;
  source: 'category' | 'default';
  categoryId: string | null;
  shopLevel: ShopLevel | null;
}

@Injectable()
export class CommissionsService implements OnModuleInit {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    @InjectRepository(CommissionRate) private readonly rateRepository: Repository<CommissionRate>,
    @InjectRepository(DeliveryZone) private readonly zoneRepository: Repository<DeliveryZone>,
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if ((await this.zoneRepository.count()) === 0) {
        await this.zoneRepository.save(DEFAULT_DELIVERY_ZONES.map((zone, index) => this.zoneRepository.create({ ...zone, sortOrder: index, isActive: true })));
        this.logger.log('Zones de livraison initialisées');
      }
      if ((await this.rateRepository.count()) === 0) {
        await this.seedGrid();
      }
    } catch (error) {
      this.logger.warn(`Amorçage commissions/livraison ignoré: ${(error as Error).message}`);
    }
  }

  async seedGrid(): Promise<number> {
    const categories = await this.categoryRepository.find({ withDeleted: false });
    const slugOf = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const rows: CommissionRate[] = [];
    const defaults = this.settings.get('commissions.defaultRates') as Record<string, number>;
    rows.push(
      this.rateRepository.create({ categoryId: null, tier: CommissionTier.NEW, ratePercent: defaults.new ?? 8 }),
      this.rateRepository.create({ categoryId: null, tier: CommissionTier.VERIFIED, ratePercent: defaults.verified ?? 7 }),
      this.rateRepository.create({ categoryId: null, tier: CommissionTier.BIG_SELLER, ratePercent: defaults.big_seller ?? 6 }),
    );
    for (const category of categories) {
      const slug = slugOf(category.name);
      const entry = DEFAULT_COMMISSION_GRID.find((g) => slugOf(g.category) === slug || g.aliases.some((alias) => slug === alias || slug.startsWith(alias + '-') || slug.includes(alias)));
      if (!entry) continue;
      rows.push(
        this.rateRepository.create({ categoryId: category.id, tier: CommissionTier.NEW, ratePercent: entry.rates[0] }),
        this.rateRepository.create({ categoryId: category.id, tier: CommissionTier.VERIFIED, ratePercent: entry.rates[1] }),
        this.rateRepository.create({ categoryId: category.id, tier: CommissionTier.BIG_SELLER, ratePercent: entry.rates[2] }),
      );
    }
    await this.rateRepository.save(rows);
    this.logger.log(`Grille de commission initialisée (${rows.length} lignes)`);
    return rows.length;
  }

  tierForLevel(level: ShopLevel | null | undefined): CommissionTier {
    if (!level) return CommissionTier.NEW;
    const bigLevels = this.settings.get('commissions.bigSellerLevels') as readonly string[];
    if (bigLevels.includes(level)) return CommissionTier.BIG_SELLER;
    if (level === ShopLevel.VERIFIED) return CommissionTier.VERIFIED;
    return CommissionTier.NEW;
  }

  async quote(sellerId: string, categoryId: string | null, at: Date = new Date()): Promise<CommissionQuote> {
    const shop = await this.shopRepository.findOne({ where: { ownerId: sellerId }, select: ['id', 'level'] });
    const tier = this.tierForLevel(shop?.level ?? null);
    const rate = await this.findRate(categoryId, tier, at);
    return {
      tier,
      tierLabel: COMMISSION_TIER_LABELS[tier],
      ratePercent: rate?.ratePercent ?? Number((this.settings.get('commissions.defaultRates') as Record<string, number>)[tier] ?? 8),
      source: rate?.categoryId ? 'category' : 'default',
      categoryId,
      shopLevel: shop?.level ?? null,
    };
  }

  private async findRate(categoryId: string | null, tier: CommissionTier, at: Date): Promise<CommissionRate | null> {
    const candidates = await this.rateRepository.find({ where: [{ categoryId: categoryId ?? IsNull(), tier }, { categoryId: IsNull(), tier }], order: { validFrom: 'DESC' } });
    const valid = candidates.filter((r) => (!r.validFrom || new Date(r.validFrom) <= at) && (!r.validTo || new Date(r.validTo) > at));
    return valid.find((r) => r.categoryId === categoryId) ?? valid.find((r) => r.categoryId === null) ?? null;
  }

  compute(subtotal: number, ratePercent: number): { commissionAmount: number; sellerNetAmount: number } {
    const commissionAmount = Math.round((subtotal * ratePercent) / 100);
    return { commissionAmount, sellerNetAmount: Math.max(0, Math.round(subtotal - commissionAmount)) };
  }

  async grid() {
    const rates = await this.rateRepository.find({ relations: ['category'], order: { tier: 'ASC' } });
    const categories = await this.categoryRepository.find({ order: { name: 'ASC' } });
    const defaults = Object.fromEntries(Object.values(CommissionTier).map((t) => [t, null as number | null]));
    rates.filter((r) => !r.categoryId).forEach((r) => { defaults[r.tier] = r.ratePercent; });
    const rows = categories.map((category) => {
      const byTier = Object.fromEntries(Object.values(CommissionTier).map((t) => [t, null as number | null]));
      rates.filter((r) => r.categoryId === category.id).forEach((r) => { byTier[r.tier] = r.ratePercent; });
      return { categoryId: category.id, categoryName: category.name, rates: byTier };
    });
    return { tiers: Object.values(CommissionTier).map((t) => ({ tier: t, label: COMMISSION_TIER_LABELS[t] })), defaults, rows, refundPolicy: this.settings.get('commissions.refundPolicy') };
  }

  async upsertRate(adminId: string, input: { categoryId: string | null; tier: CommissionTier; ratePercent: number; validFrom?: string | null; validTo?: string | null }): Promise<CommissionRate> {
    if (!(input.ratePercent >= 0 && input.ratePercent <= 50)) throw new BadRequestException('Le taux doit être compris entre 0 et 50 %');
    if (input.categoryId) {
      const exists = await this.categoryRepository.count({ where: { id: input.categoryId } });
      if (!exists) throw new NotFoundException('Catégorie non trouvée');
    }
    let rate = await this.rateRepository.findOne({ where: { categoryId: input.categoryId ?? IsNull(), tier: input.tier } });
    if (!rate) rate = this.rateRepository.create({ categoryId: input.categoryId ?? null, tier: input.tier });
    rate.ratePercent = input.ratePercent;
    rate.validFrom = input.validFrom ? new Date(input.validFrom) : null;
    rate.validTo = input.validTo ? new Date(input.validTo) : null;
    rate.updatedBy = adminId;
    return this.rateRepository.save(rate);
  }

  async removeRate(categoryId: string, tier: CommissionTier): Promise<void> {
    await this.rateRepository.delete({ categoryId, tier });
  }

  async zones(includeInactive = false): Promise<DeliveryZone[]> {
    return this.zoneRepository.find({ where: includeInactive ? {} : { isActive: true }, order: { sortOrder: 'ASC', price: 'ASC' } });
  }

  async zone(id: string): Promise<DeliveryZone> {
    const zone = await this.zoneRepository.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone de livraison non trouvée');
    return zone;
  }

  async saveZone(input: { id?: string; name: string; description?: string | null; price: number; sortOrder?: number; isActive?: boolean }): Promise<DeliveryZone> {
    if (!(input.price >= 0)) throw new BadRequestException('Le prix de livraison doit être positif');
    const zone = input.id ? await this.zone(input.id) : this.zoneRepository.create();
    zone.name = input.name.trim();
    zone.description = input.description?.trim() || null;
    zone.price = input.price;
    if (input.sortOrder !== undefined) zone.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) zone.isActive = input.isActive;
    return this.zoneRepository.save(zone);
  }

  async removeZone(id: string): Promise<void> {
    const zone = await this.zone(id);
    zone.isActive = false;
    await this.zoneRepository.save(zone);
  }
}
