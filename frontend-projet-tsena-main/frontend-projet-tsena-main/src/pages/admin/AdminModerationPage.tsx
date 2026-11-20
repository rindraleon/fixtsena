import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldAlert, MessageSquareWarning, Mail, Eye, EyeOff, Flag, Star } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useReviews } from '../../hooks/queries/useReviews';
import { useModerateReview } from '../../hooks/mutations/useReviewMutations';
import { useAdminConversations, useConversationMessages } from '../../hooks/queries/useMessaging';
import { useAdminHideMessage } from '../../hooks/mutations/useMessagingMutations';
import { useAdminEmailLogs } from '../../hooks/queries/useNotifications';
import { Button, ConfirmDialog, DataTable, EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import { FormField } from '../../components/form';
import { ReviewCard } from '../../components/reviews';
import StatusBadge from '../../shared/components/StatusBadge';
import PageHeader from '../../shared/components/PageHeader';
import { formatDateTime, partyName } from '../../lib/format';
import type { ApiConversation, ApiEmailLog, ApiReview } from '../../types/api';

type Tab = 'reviews' | 'messages' | 'emails';
const PAGE_SIZE = 10;

function ReviewsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const scope = searchParams.get('scope') === 'hidden' ? 'hidden' : searchParams.get('scope') === 'all' ? 'all' : 'reported';
  const reviewsQuery = useReviews({ reported: scope === 'reported' || undefined, includeHidden: true, page, limit: PAGE_SIZE });
  const moderate = useModerateReview();
  const [target, setTarget] = useState<{ review: ApiReview; isVisible: boolean } | null>(null);
  const [reason, setReason] = useState('');

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'reviews');
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const items = (reviewsQuery.data?.items ?? []).filter((r) => scope !== 'hidden' || !r.isVisible);
  const meta = reviewsQuery.data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Portée">
        {([['reported', 'Signalés'], ['hidden', 'Masqués'], ['all', 'Tous les avis']] as const).map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={scope === key} onClick={() => setParam('scope', key)} className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', scope === key ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:text-text')}>{label}</button>
        ))}
      </div>
      {reviewsQuery.isPending ? (
        <LoadingState variant="list" count={3} />
      ) : reviewsQuery.isError ? (
        <ErrorState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} retrying={reviewsQuery.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState icon={Star} title={scope === 'reported' ? 'Aucun avis signalé' : scope === 'hidden' ? 'Aucun avis masqué' : 'Aucun avis'} description="Les avis signalés par les clients ou les vendeurs apparaîtront ici pour décision." />
      ) : (
        <div className="space-y-3" data-testid="moderation-reviews">
          {items.map((review) => (
            <div key={review.id} className="space-y-2">
              <ReviewCard review={review} person={review.reviewer} personRole="Client" showModeration />
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-xs text-muted">Vendeur évalué : <span className="text-text">{partyName(review.reviewed)}</span>{review.product && <> · Produit : <Link to={`/produits/${review.product.slug}`} className="text-primary hover:underline">{review.product.name}</Link></>}</p>
                {review.isVisible ? (
                  <Button size="sm" variant="danger" icon={EyeOff} onClick={() => { setTarget({ review, isVisible: false }); setReason(''); }} data-testid="review-hide">Masquer</Button>
                ) : (
                  <Button size="sm" variant="outline" icon={Eye} onClick={() => { setTarget({ review, isVisible: true }); setReason(''); }} data-testid="review-restore">Rétablir</Button>
                )}
              </div>
            </div>
          ))}
          {meta && meta.totalPages > 1 && <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => setParam('page', String(p))} />}
        </div>
      )}
      <ConfirmDialog
        open={!!target}
        variant={target?.isVisible ? 'default' : 'destructive'}
        title={target?.isVisible ? 'Rétablir cet avis ?' : 'Masquer cet avis ?'}
        description={target?.isVisible ? 'L’avis redeviendra visible publiquement et la note moyenne du vendeur sera recalculée.' : 'L’avis ne sera plus visible publiquement ; la note moyenne du vendeur sera recalculée. La décision est journalisée avec son motif.'}
        confirmLabel={target?.isVisible ? 'Rétablir' : 'Masquer'}
        loadingLabel="Application..."
        loading={moderate.isPending}
        onConfirm={() => { if (target) moderate.mutate({ id: target.review.id, isVisible: target.isVisible, reason: reason.trim() || undefined }, { onSettled: () => setTarget(null) }); }}
        onCancel={() => setTarget(null)}
      >
        <FormField as="textarea" label="Motif (journalisé)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </ConfirmDialog>
    </div>
  );
}

function ConversationInspector({ conversation, onClose }: { conversation: ApiConversation; onClose: () => void }) {
  const thread = useConversationMessages(conversation.id);
  const hide = useAdminHideMessage();
  return (
    <section className="bg-surface rounded-xl border-2 border-primary/30 p-4 space-y-3" aria-label="Conversation inspectée" data-testid="conversation-inspector">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text">{partyName(conversation.buyer)} ↔ {partyName(conversation.seller)}{conversation.shop ? ` (${conversation.shop.name})` : ''}</p>
          <p className="text-xs text-muted">{conversation.subject ?? 'Sans objet'}{conversation.order ? ` · Commande ${conversation.order.orderNumber}` : ''}{conversation.product ? ` · ${conversation.product.name}` : ''} · {conversation.reportsCount} signalement{conversation.reportsCount > 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
      {thread.isPending ? <LoadingState variant="list" count={3} /> : thread.isError ? <ErrorState error={thread.error} onRetry={() => void thread.refetch()} compact /> : (
        <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {thread.data?.items.map((m) => {
            const fromBuyer = m.senderId === conversation.buyerId;
            return (
              <li key={m.id} className={clsx('rounded-lg border p-3 text-sm', m.reportedBy ? 'border-red-300 bg-red-50/50 dark:bg-red-500/5 dark:border-red-500/30' : 'border-border', m.hiddenByAdmin && 'opacity-60')}>
                <div className="flex items-center justify-between gap-2 text-xs text-muted mb-1">
                  <span><span className="font-medium text-text">{fromBuyer ? partyName(conversation.buyer) : partyName(conversation.seller)}</span> · {formatDateTime(m.createdAt)}{m.reportedBy && <span className="ml-2 inline-flex items-center gap-1 text-red-600"><Flag size={11} /> Signalé{m.reportReason ? ` — ${m.reportReason}` : ''}</span>}</span>
                  <button type="button" onClick={() => hide.mutate({ messageId: m.id, value: !m.hiddenByAdmin, conversationId: conversation.id })} disabled={hide.isPending} className="inline-flex items-center gap-1 hover:text-primary">{m.hiddenByAdmin ? <><Eye size={12} /> Rétablir</> : <><EyeOff size={12} /> Masquer</>}</button>
                </div>
                <p className={clsx('whitespace-pre-line break-words', m.hiddenByAdmin && 'italic')}>{m.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MessagesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const reportedOnly = searchParams.get('scope') !== 'all';
  const listQuery = useAdminConversations({ reported: reportedOnly || undefined, page, limit: PAGE_SIZE });
  const [selected, setSelected] = useState<ApiConversation | null>(null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'messages');
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Portée">
        {([['reported', 'Signalées'], ['all', 'Toutes']] as const).map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={(key === 'reported') === reportedOnly} onClick={() => setParam('scope', key === 'all' ? 'all' : null)} className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', (key === 'reported') === reportedOnly ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:text-text')}>{label}</button>
        ))}
      </div>
      <p className="text-xs text-muted">Accès réservé à la modération et au traitement des litiges (cahier des charges §7). Chaque consultation doit être justifiée.</p>
      {selected && <ConversationInspector conversation={selected} onClose={() => setSelected(null)} />}
      <DataTable<ApiConversation>
        data={listQuery.data?.items ?? []}
        data-testid="moderation-conversations"
        isLoading={listQuery.isPending}
        isFetching={listQuery.isFetching}
        error={listQuery.isError ? listQuery.error : null}
        onRetry={() => void listQuery.refetch()}
        emptyIcon={MessageSquareWarning}
        emptyTitle={reportedOnly ? 'Aucune conversation signalée' : 'Aucune conversation'}
        emptyDescription="Les messages signalés par les utilisateurs apparaîtront ici."
        onRowClick={setSelected}
        columns={[
          { header: 'Participants', primary: true, cell: (c) => <div className="min-w-0"><p className="font-medium text-text truncate">{partyName(c.buyer)} ↔ {partyName(c.seller)}</p><p className="text-xs text-muted truncate">{c.subject ?? c.lastMessagePreview ?? '—'}</p></div> },
          { header: 'Contexte', cell: (c) => <span className="text-xs text-muted">{c.shop?.name ?? ''}{c.order ? ` · ${c.order.orderNumber}` : ''}{c.product ? ` · ${c.product.name}` : ''}</span> },
          { header: 'Signalements', mobile: true, cell: (c) => <span className={clsx('inline-flex items-center gap-1 text-sm font-semibold', c.reportsCount > 0 ? 'text-red-600' : 'text-muted')}><Flag size={13} /> {c.reportsCount}</span> },
          { header: 'Statut', cell: (c) => <StatusBadge status={c.status} kind="generic" label={c.status === 'open' ? 'Ouverte' : c.status === 'blocked' ? 'Bloquée' : 'Archivée'} /> },
          { header: 'Dernier message', cell: (c) => <span className="text-xs text-muted">{c.lastMessageAt ? formatDateTime(c.lastMessageAt) : '—'}</span> },
        ]}
        actions={(c) => <Button size="sm" variant="outline" onClick={() => setSelected(c)}>Inspecter</Button>}
        pagination={listQuery.data?.meta ? { page, totalPages: listQuery.data.meta.totalPages, total: listQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p)) } : undefined}
      />
    </div>
  );
}

function EmailsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = (searchParams.get('status') ?? '') as '' | 'sent' | 'failed' | 'skipped';
  const logsQuery = useAdminEmailLogs({ status: status || undefined, page, limit: 20 });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'emails');
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  return (
    <DataTable<ApiEmailLog>
      data={logsQuery.data?.items ?? []}
      data-testid="email-logs"
      isLoading={logsQuery.isPending}
      isFetching={logsQuery.isFetching}
      error={logsQuery.isError ? logsQuery.error : null}
      onRetry={() => void logsQuery.refetch()}
      emptyIcon={Mail}
      emptyTitle="Aucun e-mail journalisé"
      emptyDescription="Chaque notification e-mail (commande, paiement, litige, avis, message, abonnement…) est tracée ici avec son statut d'envoi."
      toolbar={
        <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Statut d'envoi">
          <option value="">Tous les statuts</option>
          <option value="sent">Envoyés</option>
          <option value="failed">Échecs</option>
          <option value="skipped">Ignorés (consentement / désinscription)</option>
        </select>
      }
      columns={[
        { header: 'Destinataire', primary: true, cell: (l) => <div className="min-w-0"><p className="font-medium text-text truncate">{l.to}</p><p className="text-xs text-muted truncate">{l.subject}</p></div> },
        { header: 'Type', cell: (l) => <span className="text-xs font-mono text-muted">{l.type}</span> },
        { header: 'Statut', mobile: true, cell: (l) => <div><StatusBadge status={l.status} kind="generic" label={l.status === 'sent' ? 'Envoyé' : l.status === 'failed' ? 'Échec' : 'Ignoré'} />{l.lastError && <p className="text-[11px] text-danger mt-1 max-w-[220px] truncate" title={l.lastError}>{l.lastError}</p>}</div> },
        { header: 'Tentatives', cell: (l) => <span className="text-muted">{l.attempts}</span> },
        { header: 'Date', cell: (l) => <span className="text-xs text-muted">{formatDateTime(l.sentAt ?? l.createdAt)}</span> },
      ]}
      pagination={logsQuery.data?.meta ? { page, totalPages: logsQuery.data.meta.totalPages, total: logsQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p)) } : undefined}
    />
  );
}

export default function AdminModerationPage() {
  useTitle('Modération | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'messages' ? 'messages' : tabParam === 'emails' ? 'emails' : 'reviews';
  return (
    <div className="max-w-6xl">
      <PageHeader title="Modération & journaux" subtitle="Avis signalés, conversations signalées et journal des e-mails de notification" />
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto" role="tablist">
        {([['reviews', 'Avis', ShieldAlert], ['messages', 'Messagerie', MessageSquareWarning], ['emails', 'Journal e-mails', Mail]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setSearchParams({ tab: id }, { replace: true })} className={clsx('inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors', tab === id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')} data-testid={`moderation-tab-${id}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'emails' && <EmailsTab />}
    </div>
  );
}
