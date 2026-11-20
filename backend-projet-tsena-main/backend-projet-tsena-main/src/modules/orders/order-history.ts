import { EntityManager, Repository } from 'typeorm';
import { OrderStatusHistory } from '../../database/entities/transaction.entity';

export interface OrderHistoryInput {
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId?: string | null;
  actorRole?: string | null;
  comment?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function appendOrderHistory(
  source: EntityManager | Repository<OrderStatusHistory>,
  input: OrderHistoryInput,
): Promise<void> {
  const repo = source instanceof Repository ? source : source.getRepository(OrderStatusHistory);
  await repo.save(
    repo.create({
      orderId: input.orderId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      comment: input.comment?.trim() || null,
      metadata: input.metadata ?? null,
    }),
  );
}
