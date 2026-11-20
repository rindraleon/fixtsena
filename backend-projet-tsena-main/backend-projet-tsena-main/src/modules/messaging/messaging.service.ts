import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation, Message, MessageAttachment, Shop } from '../../database/entities/marketplace.entity';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/catalog.entity';
import { Order, Dispute } from '../../database/entities/transaction.entity';
import { AccountStatus, ConversationStatus, ShopStatus, UserRole } from '../../database/entities/role.enum';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MESSAGE_NOTIFICATION_TYPE,
  messageNotificationBody,
  type MessageNotificationMetadata,
} from '../notifications/message-notifications';

type AuthUser = { id: string; roles: UserRole[] };

export interface StartConversationInput {
  sellerId?: string;
  shopId?: string;
  productId?: string;
  orderId?: string;
  disputeId?: string;
  subject?: string;
  message: string;
  attachments?: MessageAttachment[];
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation) private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepository: Repository<Message>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Dispute) private readonly disputeRepository: Repository<Dispute>,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async start(user: AuthUser, input: StartConversationInput) {
    const body = this.cleanBody(input.message);
    let sellerId = input.sellerId ?? null;
    let shopId = input.shopId ?? null;
    let productId = input.productId ?? null;
    let orderId = input.orderId ?? null;
    let buyerId = user.id;

    if (input.orderId) {
      const order = await this.orderRepository.findOne({ where: { id: input.orderId } });
      if (!order) throw new NotFoundException('Commande non trouvée');
      if (order.buyerId !== user.id && order.sellerId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
        throw new ForbiddenException('Cette commande ne vous concerne pas');
      }
      buyerId = order.buyerId;
      sellerId = order.sellerId;
    }
    if (input.disputeId) {
      const dispute = await this.disputeRepository.findOne({ where: { id: input.disputeId } });
      if (!dispute) throw new NotFoundException('Litige non trouvé');
      const order = await this.orderRepository.findOne({ where: { id: dispute.orderId } });
      if (!order) throw new NotFoundException('Commande du litige non trouvée');
      if (order.buyerId !== user.id && order.sellerId !== user.id) throw new ForbiddenException('Ce litige ne vous concerne pas');
      buyerId = order.buyerId;
      sellerId = order.sellerId;
      orderId = order.id;
    }
    if (input.productId && !sellerId) {
      const product = await this.productRepository.findOne({ where: { id: input.productId }, select: ['id', 'sellerId', 'name'] });
      if (!product) throw new NotFoundException('Produit non trouvé');
      sellerId = product.sellerId;
      productId = product.id;
    }
    if (input.shopId && !sellerId) {
      const shop = await this.shopRepository.findOne({ where: { id: input.shopId } });
      if (!shop) throw new NotFoundException('Boutique non trouvée');
      sellerId = shop.ownerId;
      shopId = shop.id;
    }
    if (!sellerId) throw new BadRequestException('Indiquez un vendeur, une boutique, un produit, une commande ou un litige');
    if (sellerId === buyerId) throw new BadRequestException('Vous ne pouvez pas vous écrire à vous-même');
    if (!shopId) shopId = (await this.shopRepository.findOne({ where: { ownerId: sellerId }, select: ['id'] }))?.id ?? null;

    await this.assertCanWrite(user.id, buyerId, sellerId, shopId);

    const where: Record<string, unknown> = { buyerId, sellerId };
    if (orderId) where.orderId = orderId;
    else if (productId) where.productId = productId;
    else { where.orderId = null as unknown as string; where.productId = null as unknown as string; }
    let conversation = await this.conversationRepository.findOne({ where: where as never, order: { createdAt: 'DESC' } });
    if (conversation && conversation.status === ConversationStatus.BLOCKED) {
      throw new ForbiddenException(conversation.blockedBy === user.id ? 'Vous avez bloqué cette conversation' : 'Cette conversation a été bloquée par votre interlocuteur');
    }
    if (!conversation) {
      conversation = await this.conversationRepository.save(this.conversationRepository.create({
        buyerId,
        sellerId,
        shopId,
        productId,
        orderId,
        disputeId: input.disputeId ?? null,
        subject: input.subject?.trim().slice(0, 160) || (await this.defaultSubject(productId, orderId)),
        status: ConversationStatus.OPEN,
      }));
    }
    const message = await this.appendMessage(conversation, user.id, body, input.attachments ?? []);
    return { conversation: await this.view(conversation, user.id), message };
  }

  async send(user: AuthUser, conversationId: string, text: string, attachments: MessageAttachment[] = []) {
    const conversation = await this.getOwned(conversationId, user);
    if (conversation.status === ConversationStatus.BLOCKED) {
      throw new ForbiddenException(conversation.blockedBy === user.id ? 'Vous avez bloqué cette conversation : débloquez-la pour écrire' : 'Cette conversation a été bloquée par votre interlocuteur');
    }
    await this.assertCanWrite(user.id, conversation.buyerId, conversation.sellerId, conversation.shopId);
    const body = this.cleanBody(text);
    if (conversation.archivedBy?.includes(user.id)) {
      conversation.archivedBy = conversation.archivedBy.filter((id) => id !== user.id);
    }
    const message = await this.appendMessage(conversation, user.id, body, attachments);
    return { conversation: await this.view(conversation, user.id), message };
  }

  private async appendMessage(conversation: Conversation, senderId: string, body: string, attachments: MessageAttachment[]): Promise<Message> {
    if (attachments.length > 0 && !this.settings.get('messaging.attachmentsAllowed')) {
      throw new BadRequestException('Les pièces jointes sont désactivées');
    }
    const message = await this.messageRepository.save(this.messageRepository.create({ conversationId: conversation.id, senderId, body, attachments: attachments.length ? attachments : null }));
    const toSeller = senderId === conversation.buyerId;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessagePreview = body.slice(0, 140);
    if (toSeller) conversation.sellerUnreadCount += 1;
    else conversation.buyerUnreadCount += 1;
    conversation.status = ConversationStatus.OPEN;
    await this.conversationRepository.save(conversation);

    const recipientId = toSeller ? conversation.sellerId : conversation.buyerId;
    const sender = await this.userRepository.findOne({ where: { id: senderId }, select: ['id', 'firstName', 'lastName', 'avatarUrl'] });
    const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || 'un utilisateur';
    const shop = conversation.shopId
      ? await this.shopRepository.findOne({ where: { id: conversation.shopId }, select: ['id', 'name'] })
      : null;

    await this.notifications.notify({
      userId: recipientId,
      type: MESSAGE_NOTIFICATION_TYPE,
      title: `Nouveau message de ${senderName}`,
      body: messageNotificationBody(senderName),
      link: this.conversationLink(toSeller, conversation.id),
      metadata: {
        conversationId: conversation.id,
        messageId: message.id,
        senderId,
        senderName,
        senderAvatarUrl: sender?.avatarUrl ?? null,
        shopId: conversation.shopId,
        shopName: shop?.name ?? null,
        subject: conversation.subject,
      } satisfies MessageNotificationMetadata,
      email: { subject: `Tsena — Nouveau message de ${senderName}`, nextAction: 'Répondre depuis votre messagerie', actionLabel: 'Répondre' },
    });
    return message;
  }

  private async assertCanWrite(actorId: string, buyerId: string, sellerId: string, shopId: string | null): Promise<void> {
    const users = await this.userRepository.find({ where: { id: In([buyerId, sellerId]) }, select: ['id', 'status', 'roles'] });
    const seller = users.find((u) => u.id === sellerId);
    const buyer = users.find((u) => u.id === buyerId);
    if (!seller) throw new NotFoundException('Vendeur non trouvé');
    if (!buyer) throw new NotFoundException('Client non trouvé');
    if (seller.status === AccountStatus.SUSPENDED || seller.status === AccountStatus.DISABLED) {
      throw new ForbiddenException(actorId === sellerId ? 'Votre compte est suspendu : messagerie indisponible' : 'Ce vendeur est suspendu : la messagerie est indisponible');
    }
    if (buyer.status === AccountStatus.SUSPENDED || buyer.status === AccountStatus.DISABLED) {
      throw new ForbiddenException(actorId === buyerId ? 'Votre compte est suspendu : messagerie indisponible' : 'Ce client est bloqué : la messagerie est indisponible');
    }
    if (shopId) {
      const shop = await this.shopRepository.findOne({ where: { id: shopId }, select: ['id', 'status'] });
      if (shop && (shop.status === ShopStatus.SUSPENDED || shop.status === ShopStatus.DISABLED || shop.status === ShopStatus.ARCHIVED)) {
        throw new ForbiddenException('Cette boutique est suspendue : la messagerie est indisponible');
      }
    }
  }

  async list(user: AuthUser, options: { role?: 'buyer' | 'seller'; archived?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const qb = this.conversationRepository.createQueryBuilder('c');
    if (options.role === 'buyer') qb.where('c.buyerId = :id', { id: user.id });
    else if (options.role === 'seller') qb.where('c.sellerId = :id', { id: user.id });
    else qb.where('(c.buyerId = :id OR c.sellerId = :id)', { id: user.id });
    if (options.archived) qb.andWhere("(',' || COALESCE(c.archivedBy, '') || ',') LIKE :me", { me: `%,${user.id},%` });
    else qb.andWhere("(c.archivedBy IS NULL OR (',' || c.archivedBy || ',') NOT LIKE :me)", { me: `%,${user.id},%` });
    qb.orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST').addOrderBy('c.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items: await this.views(items, user.id), total, page, limit };
  }

  private conversationLink(recipientIsSeller: boolean, conversationId: string): string {
    return recipientIsSeller
      ? `/dashboard/vendeur/messages?conversation=${conversationId}`
      : `/dashboard/client/messages?conversation=${conversationId}`;
  }

  async unreadCount(userId: string): Promise<number> {
    const row = await this.conversationRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(CASE WHEN c.buyerId = :id THEN c.buyerUnreadCount ELSE 0 END),0)', 'asBuyer')
      .addSelect('COALESCE(SUM(CASE WHEN c.sellerId = :id THEN c.sellerUnreadCount ELSE 0 END),0)', 'asSeller')
      .where('(c.buyerId = :id OR c.sellerId = :id)', { id: userId })
      .andWhere('c.status != :blocked', { blocked: ConversationStatus.BLOCKED })
      .getRawOne<{ asBuyer: string; asSeller: string }>();
    return Number(row?.asBuyer ?? 0) + Number(row?.asSeller ?? 0);
  }

  async messages(user: AuthUser, conversationId: string, options: { page?: number; limit?: number; markRead?: boolean } = {}) {
    const conversation = await this.getOwned(conversationId, user, true);
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const [rows, total] = await this.messageRepository.findAndCount({ where: { conversationId }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    const isParty = conversation.buyerId === user.id || conversation.sellerId === user.id;
    if (isParty && options.markRead !== false) {
      const field = conversation.buyerId === user.id ? 'buyerUnreadCount' : 'sellerUnreadCount';
      if (conversation[field] > 0) {
        conversation[field] = 0;
        await this.conversationRepository.save(conversation);
      }
      await this.messageRepository.createQueryBuilder().update(Message).set({ readAt: new Date() }).where('conversationId = :conversationId AND senderId != :me AND readAt IS NULL', { conversationId, me: user.id }).execute();

      await this.notifications.markConversationRead(user.id, conversationId);
    }
    const items = rows.reverse().map((m) => (m.isHidden && !user.roles.includes(UserRole.ADMIN) ? { ...m, body: '[Message masqué par la modération]', attachments: null } : m));
    return { conversation: await this.view(conversation, user.id), items, total, page, limit };
  }

  async archive(user: AuthUser, conversationId: string, archived: boolean) {
    const conversation = await this.getOwned(conversationId, user);
    const set = new Set(conversation.archivedBy ?? []);
    if (archived) set.add(user.id); else set.delete(user.id);
    conversation.archivedBy = set.size ? [...set] : null;
    await this.conversationRepository.save(conversation);
    return this.view(conversation, user.id);
  }

  async block(user: AuthUser, conversationId: string, blocked: boolean) {
    const conversation = await this.getOwned(conversationId, user);
    if (blocked) {
      if (conversation.status === ConversationStatus.BLOCKED && conversation.blockedBy !== user.id) throw new ConflictException('Cette conversation est déjà bloquée par votre interlocuteur');
      conversation.status = ConversationStatus.BLOCKED;
      conversation.blockedBy = user.id;
    } else {
      if (conversation.blockedBy !== user.id) throw new ForbiddenException('Seule la personne ayant bloqué la conversation peut la débloquer');
      conversation.status = ConversationStatus.OPEN;
      conversation.blockedBy = null;
    }
    await this.conversationRepository.save(conversation);
    return this.view(conversation, user.id);
  }

  async report(user: AuthUser, messageId: string, reason: string) {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message non trouvé');
    const conversation = await this.getOwned(message.conversationId, user);
    if (message.senderId === user.id) throw new BadRequestException('Vous ne pouvez pas signaler votre propre message');
    if (message.reportedAt) throw new ConflictException('Ce message a déjà été signalé');
    message.reportedBy = user.id;
    message.reportReason = reason.trim().slice(0, 500);
    message.reportedAt = new Date();
    await this.messageRepository.save(message);
    conversation.reportsCount += 1;
    await this.conversationRepository.save(conversation);
    return message;
  }

  async adminList(options: { reported?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const qb = this.conversationRepository.createQueryBuilder('c');
    if (options.reported) qb.where('c.reportsCount > 0');
    qb.orderBy('c.reportsCount', 'DESC').addOrderBy('c.lastMessageAt', 'DESC', 'NULLS LAST').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items: await this.views(items), total, page, limit };
  }

  async adminHide(messageId: string, hidden: boolean): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message non trouvé');
    message.isHidden = hidden;
    return this.messageRepository.save(message);
  }

  private async getOwned(conversationId: string, user: AuthUser, allowAdmin = false): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation non trouvée');
    const isParty = conversation.buyerId === user.id || conversation.sellerId === user.id;
    if (!isParty && !(allowAdmin && user.roles.includes(UserRole.ADMIN))) throw new ForbiddenException('Vous n\'avez pas accès à cette conversation');
    return conversation;
  }

  private cleanBody(text: string): string {
    const body = (text ?? '').replace(/\r\n/g, '\n').trim();
    if (!body) throw new BadRequestException('Le message ne peut pas être vide');
    const max = Number(this.settings.get('messaging.maxMessageLength')) || 2000;
    if (body.length > max) throw new BadRequestException(`Le message ne peut pas dépasser ${max} caractères`);
    return body;
  }

  private async defaultSubject(productId: string | null, orderId: string | null): Promise<string | null> {
    if (orderId) {
      const order = await this.orderRepository.findOne({ where: { id: orderId }, select: ['id', 'orderNumber'] });
      return order ? `Commande ${order.orderNumber}` : null;
    }
    if (productId) {
      const product = await this.productRepository.findOne({ where: { id: productId }, select: ['id', 'name'] });
      return product ? `À propos de « ${product.name} »` : null;
    }
    return null;
  }

  private async view(conversation: Conversation, viewerId?: string) {
    const [v] = await this.views([conversation], viewerId);
    return v;
  }

  private async views(conversations: Conversation[], viewerId?: string) {
    if (conversations.length === 0) return [];
    const userIds = [...new Set(conversations.flatMap((c) => [c.buyerId, c.sellerId]))];
    const users = await this.userRepository.find({ where: { id: In(userIds) }, select: ['id', 'firstName', 'lastName', 'avatarUrl', 'status'] });
    const userMap = new Map(users.map((u) => [u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl, status: u.status }]));
    const shopIds = [...new Set(conversations.map((c) => c.shopId).filter(Boolean))] as string[];
    const shops = shopIds.length ? await this.shopRepository.find({ where: { id: In(shopIds) }, select: ['id', 'name', 'slug', 'logoUrl', 'status'] }) : [];
    const shopMap = new Map(shops.map((s) => [s.id, s]));
    const productIds = [...new Set(conversations.map((c) => c.productId).filter(Boolean))] as string[];
    const products = productIds.length ? await this.productRepository.find({ where: { id: In(productIds) }, select: ['id', 'name', 'slug'] }) : [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    const orderIds = [...new Set(conversations.map((c) => c.orderId).filter(Boolean))] as string[];
    const orders = orderIds.length ? await this.orderRepository.find({ where: { id: In(orderIds) }, select: ['id', 'orderNumber', 'status'] }) : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return conversations.map((c) => {
      const viewerIsBuyer = viewerId === c.buyerId;
      return {
        ...c,
        buyer: userMap.get(c.buyerId) ?? null,
        seller: userMap.get(c.sellerId) ?? null,
        shop: c.shopId ? shopMap.get(c.shopId) ?? null : null,
        product: c.productId ? productMap.get(c.productId) ?? null : null,
        order: c.orderId ? orderMap.get(c.orderId) ?? null : null,
        unreadCount: viewerId ? (viewerIsBuyer ? c.buyerUnreadCount : c.sellerUnreadCount) : c.buyerUnreadCount + c.sellerUnreadCount,
        isArchived: viewerId ? (c.archivedBy ?? []).includes(viewerId) : false,
        isBlockedByMe: viewerId ? c.blockedBy === viewerId : false,
        myRole: viewerId ? (viewerIsBuyer ? 'buyer' : 'seller') : null,
      };
    });
  }
}
