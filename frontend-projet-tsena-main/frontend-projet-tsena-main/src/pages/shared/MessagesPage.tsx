import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Ban, Flag, MessageSquare, Paperclip, Send, ShieldOff, Store, User, ChevronLeft, Package, Receipt, Image as ImageIcon, FileText, Search, Inbox, MailOpen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useConversationMessages, useConversations } from '../../hooks/queries/useMessaging';
import { useArchiveConversation, useBlockConversation, useReportMessage, useSendMessage, useUploadMessageAttachment } from '../../hooks/mutations/useMessagingMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import { formatDateTime, formatRelativeDate, partyName } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/media';
import { queryKeys } from '../../lib/query-keys';
import type { ApiConversation, ApiMessage, MessageAttachment } from '../../types/api';

interface MessagesPageProps {
  readonly role: 'buyer' | 'seller';
}

const MESSAGE_MAX = 2000;
const ATTACHMENT_MAX_MB = 5;

function otherParty(conversation: ApiConversation, role: 'buyer' | 'seller') {
  return role === 'buyer' ? conversation.seller : conversation.buyer;
}

function partnerName(conversation: ApiConversation, role: 'buyer' | 'seller'): string {
  if (role === 'buyer' && conversation.shop) return conversation.shop.name;
  return partyName(otherParty(conversation, role));
}

function PartnerAvatar({ conversation, role, size = 40 }: { readonly conversation: ApiConversation; readonly role: 'buyer' | 'seller'; readonly size?: number }) {
  const other = otherParty(conversation, role);
  const imageUrl = role === 'buyer' ? conversation.shop?.logoUrl ?? other?.avatarUrl ?? null : other?.avatarUrl ?? null;
  return (
    <span className="rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden" style={{ width: size, height: size }} aria-hidden="true">
      {imageUrl
        ? <img src={resolveMediaUrl(imageUrl)} alt="" className="w-full h-full object-cover" />
        : role === 'buyer' ? <Store size={Math.round(size / 2.2)} /> : <User size={Math.round(size / 2.2)} />}
    </span>
  );
}

function AttachmentChip({ attachment, mine }: { readonly attachment: MessageAttachment; readonly mine: boolean }) {
  const isImage = attachment.mimeType?.startsWith('image/');
  return (
    <a
      href={resolveMediaUrl(attachment.url)}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx('inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline max-w-full', mine ? 'text-white/90' : 'text-primary')}
    >
      {isImage ? <ImageIcon size={12} /> : <FileText size={12} />} <span className="truncate">{attachment.name}</span>
    </a>
  );
}

function InfoRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-xs text-text text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function MessagesPage({ role }: MessagesPageProps) {
  useTitle(role === 'seller' ? 'Messagerie | Vendeur' : 'Messagerie | Mon compte');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversation');
  const showArchived = searchParams.get('archived') === '1';
  const [search, setSearch] = useState('');

  const conversationsQuery = useConversations({ role, archived: showArchived, limit: 50 });
  const conversations = useMemo(() => conversationsQuery.data?.items ?? [], [conversationsQuery.data?.items]);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const threadQuery = useConversationMessages(selectedId ?? undefined);
  const thread = threadQuery.data;
  const conversation = thread?.conversation ?? selected;
  const totalUnread = useMemo(() => conversations.reduce((total, c) => total + (c.unreadCount ?? 0), 0), [conversations]);
  const visibleConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) => [partnerName(c, role), c.subject ?? '', c.lastMessagePreview ?? '']
      .some((value) => value.toLowerCase().includes(term)));
  }, [conversations, role, search]);

  const sendMessage = useSendMessage();
  const uploadAttachment = useUploadMessageAttachment();
  const archive = useArchiveConversation();
  const block = useBlockConversation();
  const report = useReportMessage();
  const blockConfirm = useConfirmAction<ApiConversation>();
  const [reporting, setReporting] = useState<ApiMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.items.length, selectedId]);

  const readConversationId = thread?.conversation?.id;
  const readConversationVersion = thread?.conversation?.updatedAt;
  useEffect(() => {
    if (!readConversationId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.list({ role, archived: showArchived, limit: 50 }) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.unreadCount() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  }, [readConversationId, readConversationVersion, queryClient, role, showArchived]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('conversation', id); else next.delete('conversation');
    setSearchParams(next, { replace: true });
  };

  const toggleArchivedView = () => {
    const next = new URLSearchParams();
    if (!showArchived) next.set('archived', '1');
    setSearchParams(next, { replace: true });
  };

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!conversation || (!message && pendingAttachments.length === 0) || sendMessage.isPending) return;
    sendMessage.mutate(
      { conversationId: conversation.id, dto: { message: message || 'Pièce jointe', attachments: pendingAttachments.length ? pendingAttachments : undefined } },
      { onSuccess: () => { setDraft(''); setPendingAttachments([]); } },
    );
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !conversation) return;
    if (file.size > ATTACHMENT_MAX_MB * 1024 * 1024) { setAttachmentError(`Fichier trop volumineux (max ${ATTACHMENT_MAX_MB} Mo).`); return; }
    setAttachmentError(null);
    try {
      const uploaded = await uploadAttachment.mutateAsync({ conversationId: conversation.id, file });
      setPendingAttachments((prev) => [...prev, uploaded]);
    } catch {
    }
  };

  const submitReport = () => {
    if (!reporting || reportReason.trim().length < 5) return;
    report.mutate({ messageId: reporting.id, reason: reportReason.trim(), conversationId: reporting.conversationId }, { onSettled: () => { setReporting(null); setReportReason(''); } });
  };

  const isBlocked = conversation?.status === 'blocked';
  const canWrite = conversation && conversation.status === 'open';
  const partner = conversation ? otherParty(conversation, role) : null;

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Messagerie"
        subtitle={role === 'seller'
          ? 'Échangez avec vos clients à propos de vos produits et commandes'
          : 'Échangez avec les vendeurs à propos de vos achats'}
        actions={
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg" data-testid="messages-unread-total">
                <Inbox size={14} /> {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
              </span>
            )}
            <Button variant="outline" size="sm" icon={showArchived ? ArchiveRestore : Archive} onClick={toggleArchivedView}>
              {showArchived ? 'Conversations actives' : 'Archivées'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_280px] gap-4 min-h-[60vh]" data-testid="messages-page">

        <aside className={clsx('bg-surface rounded-xl border border-border overflow-hidden flex flex-col', selectedId && 'hidden lg:flex')} aria-label="Conversations">
          <div className="p-3 border-b border-border">
            <label className="relative block">
              <span className="sr-only">Rechercher une conversation</span>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-8 pr-3 py-2 border border-input-border rounded-lg text-sm bg-input-bg text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="conversation-search"
              />
            </label>
          </div>
          {conversationsQuery.isPending ? (
            <div className="p-4"><LoadingState variant="list" count={4} /></div>
          ) : conversationsQuery.isError ? (
            <div className="p-4"><ErrorState error={conversationsQuery.error} onRetry={() => void conversationsQuery.refetch()} retrying={conversationsQuery.isFetching} compact /></div>
          ) : visibleConversations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={MessageSquare}
                compact
                title={search ? 'Aucun résultat' : showArchived ? 'Aucune conversation archivée' : 'Aucune conversation'}
                description={search ? 'Aucune conversation ne correspond à cette recherche.' : role === 'seller' ? 'Les messages de vos clients apparaîtront ici.' : 'Contactez un vendeur depuis une fiche produit ou une commande pour démarrer une conversation.'}
                action={search ? undefined : role === 'buyer' && !showArchived ? { label: 'Parcourir les produits', to: '/produits' } : undefined}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto max-h-[70vh]" data-testid="conversation-list">
              {visibleConversations.map((c) => {
                const active = c.id === selectedId;
                const unread = c.unreadCount > 0;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => select(c.id)}
                      className={clsx('w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-secondary transition-colors', active && 'bg-primary/5 border-l-2 border-primary')}
                      aria-current={active ? 'true' : undefined}
                      data-testid="conversation-item"
                    >
                      <PartnerAvatar conversation={c} role={role} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={clsx('truncate text-sm text-text', unread ? 'font-bold' : 'font-medium')}>{partnerName(c, role)}</span>
                          {c.lastMessageAt && <span className="text-[11px] text-muted shrink-0">{formatRelativeDate(c.lastMessageAt)}</span>}
                        </span>
                        {c.subject && <span className="block text-xs text-primary truncate">{c.subject}</span>}
                        <span className={clsx('block text-xs truncate', unread ? 'text-text' : 'text-muted')}>{c.lastMessagePreview ?? '…'}</span>
                      </span>
                      {unread && (
                        <span className="self-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center" aria-label={`${c.unreadCount} message(s) non lu(s)`}>{c.unreadCount}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className={clsx('bg-surface rounded-xl border border-border flex flex-col min-h-[60vh]', !selectedId && 'hidden lg:flex')} aria-label="Discussion">
          {conversation ? (
            <>
              <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <button type="button" onClick={() => select(null)} className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-surface-secondary text-muted" aria-label="Retour à la liste"><ChevronLeft size={18} /></button>
                <PartnerAvatar conversation={conversation} role={role} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text truncate flex items-center gap-2">
                    {role === 'buyer' && conversation.shop
                      ? <Link to={`/boutiques/${conversation.shop.slug}`} className="hover:text-primary">{conversation.shop.name}</Link>
                      : partyName(partner)}
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-surface-secondary text-muted">
                      {role === 'buyer' ? 'Vendeur' : 'Client'}
                    </span>
                    {isBlocked && <span className="text-[11px] font-medium text-red-600 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">Bloquée</span>}
                  </p>
                  <p className="text-xs text-muted truncate flex flex-wrap gap-x-3">
                    {conversation.subject && <span>{conversation.subject}</span>}
                    {conversation.product && <Link to={`/produits/${conversation.product.slug}`} className="inline-flex items-center gap-1 hover:text-primary"><Package size={11} /> {conversation.product.name}</Link>}
                    {conversation.order && <span className="inline-flex items-center gap-1"><Receipt size={11} /> Commande {conversation.order.orderNumber}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" title={conversation.isArchived ? 'Désarchiver' : 'Archiver'} aria-label={conversation.isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'} onClick={() => archive.mutate({ conversationId: conversation.id, value: !conversation.isArchived })} disabled={archive.isPending} className="p-2 rounded-lg hover:bg-surface-secondary text-muted hover:text-text">{conversation.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
                  {conversation.isBlockedByMe ? (
                    <button type="button" title="Débloquer" aria-label="Débloquer la conversation" onClick={() => block.mutate({ conversationId: conversation.id, value: false })} disabled={block.isPending} className="p-2 rounded-lg hover:bg-surface-secondary text-muted hover:text-text"><ShieldOff size={16} /></button>
                  ) : (
                    <button type="button" title="Bloquer cet interlocuteur" aria-label="Bloquer cet interlocuteur" onClick={() => blockConfirm.request(conversation)} disabled={block.isPending || isBlocked} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-danger disabled:opacity-40" data-testid="conversation-block"><Ban size={16} /></button>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-[55vh]" data-testid="message-thread">
                {threadQuery.isPending ? (
                  <LoadingState variant="list" count={3} />
                ) : threadQuery.isError ? (
                  <ErrorState error={threadQuery.error} onRetry={() => void threadQuery.refetch()} retrying={threadQuery.isFetching} compact />
                ) : (thread?.items.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted text-center py-8">Aucun message pour le moment.</p>
                ) : (
                  thread?.items.map((m) => {
                    const mine = m.senderId === user?.id;
                    return (
                      <div key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')} data-testid="message-bubble">
                        <div className={clsx('group max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine ? 'bg-primary text-white rounded-br-md' : 'bg-surface-secondary text-text rounded-bl-md', m.hiddenByAdmin && 'opacity-60 italic')}>
                          {m.hiddenByAdmin ? <p>Message masqué par la modération.</p> : <p className="whitespace-pre-line break-words">{m.body}</p>}
                          {m.attachments && m.attachments.length > 0 && !m.hiddenByAdmin && (
                            <ul className="mt-2 space-y-1">
                              {m.attachments.map((a) => <li key={a.url}><AttachmentChip attachment={a} mine={mine} /></li>)}
                            </ul>
                          )}
                          <div className={clsx('flex items-center justify-between gap-3 mt-1 text-[10px]', mine ? 'text-white/70' : 'text-muted')}>
                            <span className="inline-flex items-center gap-1">
                              {formatDateTime(m.createdAt)}
                              {mine && (
                                <span className="inline-flex items-center gap-0.5" title={m.readAt ? 'Lu par votre interlocuteur' : 'Envoyé'}>
                                  · {m.readAt ? 'Lu' : 'Envoyé'} {m.readAt ? <MailOpen size={10} aria-hidden="true" /> : null}
                                </span>
                              )}
                            </span>
                            {!mine && !m.reportedBy && (
                              <button type="button" onClick={() => setReporting(m)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 hover:text-danger transition-opacity" aria-label="Signaler ce message"><Flag size={10} /> Signaler</button>
                            )}
                            {!mine && m.reportedBy && <span className="inline-flex items-center gap-1"><Flag size={10} /> Signalé</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <footer className="border-t border-border p-3">
                {canWrite ? (
                  <form onSubmit={handleSend} className="space-y-2" data-testid="message-form">
                    {pendingAttachments.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {pendingAttachments.map((a) => (
                          <li key={a.url} className="inline-flex items-center gap-1.5 text-xs bg-surface-secondary border border-border rounded-full px-2.5 py-1">
                            <Paperclip size={11} /> <span className="truncate max-w-[160px]">{a.name}</span>
                            <button type="button" onClick={() => setPendingAttachments((prev) => prev.filter((x) => x.url !== a.url))} className="text-muted hover:text-danger" aria-label={`Retirer ${a.name}`}>×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {attachmentError && <p className="text-xs text-danger" role="alert">{attachmentError}</p>}
                    <div className="flex items-end gap-2">
                      <input ref={fileInputRef} type="file" className="sr-only" accept="image/*,.pdf" onChange={(e) => void handleFile(e)} aria-label="Joindre un fichier" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadAttachment.isPending} className="p-2.5 rounded-lg border border-border text-muted hover:text-primary hover:border-primary/40 disabled:opacity-50" title={`Joindre une image ou un PDF (max ${ATTACHMENT_MAX_MB} Mo)`} aria-label="Joindre un fichier"><Paperclip size={18} /></button>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(e); }}
                        rows={2}
                        maxLength={MESSAGE_MAX}
                        placeholder="Écrivez votre message… (Ctrl+Entrée pour envoyer)"
                        className="flex-1 px-3 py-2 border border-input-border rounded-lg text-sm bg-input-bg text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                        aria-label="Message"
                        data-testid="message-input"
                      />
                      <Button type="submit" icon={Send} loading={sendMessage.isPending} loadingLabel="Envoi..." disabled={!draft.trim() && pendingAttachments.length === 0} data-testid="message-send">Envoyer</Button>
                    </div>
                    <p className="text-[11px] text-muted">Ne partagez jamais de mot de passe ni de code de paiement. Les échanges peuvent être consultés par la modération en cas de litige.</p>
                  </form>
                ) : (
                  <p className="text-sm text-muted text-center py-2 flex items-center justify-center gap-2">
                    <Ban size={14} /> {isBlocked ? (conversation.isBlockedByMe ? 'Vous avez bloqué cette conversation.' : 'Cette conversation a été bloquée par votre interlocuteur.') : 'Cette conversation est fermée.'}
                  </p>
                )}
              </footer>
            </>
          ) : selectedId && threadQuery.isError ? (
            <div className="p-6"><EmptyState icon={MessageSquare} compact title="Conversation introuvable" description="Elle a peut-être été archivée." action={{ label: 'Voir les conversations', to: '?' }} /></div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState icon={MessageSquare} compact title="Sélectionnez une conversation" description="Choisissez un échange dans la liste pour lire les messages." />
            </div>
          )}
        </section>

        <aside className="hidden xl:block bg-surface rounded-xl border border-border p-4 self-start" aria-label="Informations sur la conversation">
          {conversation ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-2">
                <PartnerAvatar conversation={conversation} role={role} size={64} />
                <p className="font-semibold text-text">{partnerName(conversation, role)}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {role === 'buyer' ? 'Vendeur' : 'Client'}
                </span>
              </div>
              <div className="divide-y divide-border">
                {role === 'buyer' && conversation.shop && (
                  <InfoRow label="Boutique">
                    <Link to={`/boutiques/${conversation.shop.slug}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Store size={11} /> {conversation.shop.name}</Link>
                  </InfoRow>
                )}
                <InfoRow label="Sujet">{conversation.subject ?? '—'}</InfoRow>
                <InfoRow label="Statut">
                  {isBlocked ? <span className="text-danger">Bloquée</span> : conversation.isArchived ? 'Archivée' : 'Ouverte'}
                </InfoRow>
                <InfoRow label="Non lus">
                  <span className={clsx('font-semibold', conversation.unreadCount > 0 ? 'text-primary' : 'text-muted')}>{conversation.unreadCount}</span>
                </InfoRow>
                <InfoRow label="Démarrée le">{formatDateTime(conversation.createdAt)}</InfoRow>
                {conversation.product && (
                  <InfoRow label="Produit">
                    <Link to={`/produits/${conversation.product.slug}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Package size={11} /> {conversation.product.name}</Link>
                  </InfoRow>
                )}
                {conversation.order && (
                  <InfoRow label="Commande">
                    <span className="inline-flex items-center gap-1"><Receipt size={11} /> {conversation.order.orderNumber}</span>
                  </InfoRow>
                )}
              </div>
              <p className="text-[11px] text-muted border-t border-border pt-3">
                Les messages restent consultables uniquement ici. Les notifications signalent leur réception, sans en afficher le contenu.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-6">Sélectionnez une conversation pour voir les informations de votre interlocuteur.</p>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={blockConfirm.isOpen}
        variant="destructive"
        title="Bloquer cet interlocuteur ?"
        description="Plus aucun message ne pourra être échangé dans cette conversation tant que vous ne la débloquez pas. Les commandes en cours ne sont pas affectées."
        confirmLabel="Bloquer"
        loadingLabel="Blocage..."
        loading={block.isPending}
        onConfirm={() => void blockConfirm.run((c) => block.mutateAsync({ conversationId: c.id, value: true }))}
        onCancel={blockConfirm.cancel}
      />

      <ConfirmDialog
        open={!!reporting}
        variant="destructive"
        title="Signaler ce message ?"
        description="La modération examinera ce message. Indiquez le motif du signalement."
        confirmLabel="Envoyer le signalement"
        loadingLabel="Envoi..."
        loading={report.isPending}
        onConfirm={submitReport}
        onCancel={() => { setReporting(null); setReportReason(''); }}
      >
        <FormField as="textarea" label="Motif" rows={3} value={reportReason} onChange={(e) => setReportReason(e.target.value)} maxLength={500} required error={reportReason.length > 0 && reportReason.trim().length < 5 ? '5 caractères minimum.' : undefined} />
      </ConfirmDialog>
    </div>
  );
}
