import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/transaction.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    @InjectRepository(Address) private readonly addressRepository: Repository<Address>,
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async list(userId: string): Promise<Address[]> {
    return this.addressRepository.find({ where: { userId }, order: { isDefault: 'DESC', updatedAt: 'DESC' } });
  }

  async findOwned(userId: string, id: string): Promise<Address> {
    const address = await this.addressRepository.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Adresse introuvable');
    return address;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addressRepository.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException(`Vous ne pouvez pas enregistrer plus de ${MAX_ADDRESSES} adresses`);
    }
    const makeDefault = dto.isDefault || count === 0;
    if (makeDefault) await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
    const address = this.addressRepository.create({
      state: '',
      postalCode: '',
      country: 'Madagascar',
      ...this.normalize(dto),
      userId,
      isDefault: makeDefault,
    });
    const saved = await this.addressRepository.save(address);
    if (makeDefault) await this.audit(userId, 'address_default_changed', saved.id, { label: saved.label, city: saved.city });
    return saved;
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOwned(userId, id);
    const wasDefault = address.isDefault;
    Object.assign(address, this.normalize(dto));
    if (dto.isDefault === true && !wasDefault) {
      await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
      address.isDefault = true;
    } else if (dto.isDefault === false && wasDefault) {
      address.isDefault = true;
    }
    const saved = await this.addressRepository.save(address);
    if (saved.isDefault && !wasDefault) await this.audit(userId, 'address_default_changed', saved.id, { label: saved.label, city: saved.city });
    return saved;
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    const address = await this.findOwned(userId, id);
    if (address.isDefault) return address;
    await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
    address.isDefault = true;
    const saved = await this.addressRepository.save(address);
    await this.audit(userId, 'address_default_changed', saved.id, { label: saved.label, city: saved.city });
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.findOwned(userId, id);
    await this.addressRepository.softRemove(address);
    if (address.isDefault) {
      const next = await this.addressRepository.findOne({ where: { userId }, order: { updatedAt: 'DESC' } });
      if (next) {
        next.isDefault = true;
        await this.addressRepository.save(next);
        await this.audit(userId, 'address_default_changed', next.id, { label: next.label, city: next.city, reason: 'previous_default_removed' });
      }
    }
    this.logger.log(`Adresse ${id} supprimée par ${userId}`);
  }

  private normalize(dto: Partial<CreateAddressDto>): Partial<Address> {
    const out: Partial<Address> = {};
    const text = (value: string | null | undefined): string | undefined => (value === undefined ? undefined : (value ?? '').trim());
    const label = text(dto.label);
    const recipientName = text(dto.recipientName);
    const phone = text(dto.phone);
    const street = text(dto.street);
    const complement = text(dto.complement);
    const city = text(dto.city);
    const state = text(dto.state);
    const postalCode = text(dto.postalCode);
    const country = text(dto.country);
    const instructions = text(dto.instructions);
    if (label !== undefined) out.label = label;
    if (recipientName !== undefined) out.recipientName = recipientName;
    if (phone !== undefined) out.phone = phone;
    if (street !== undefined) out.street = street;
    if (complement !== undefined) out.complement = complement || (null as unknown as string);
    if (city !== undefined) out.city = city;
    if (state !== undefined) out.state = state;
    if (postalCode !== undefined) out.postalCode = postalCode;
    if (country !== undefined) out.country = country || 'Madagascar';
    if (instructions !== undefined) out.instructions = instructions || null;
    return out;
  }

  private async audit(userId: string, action: string, entityId: string, changes: Record<string, unknown>): Promise<void> {
    try {
      await this.auditLogRepository.save(this.auditLogRepository.create({ userId, action, entity: 'address', entityId, changes }));
    } catch (error) {
      this.logger.warn(`Journalisation adresse impossible : ${(error as Error).message}`);
    }
  }
}
