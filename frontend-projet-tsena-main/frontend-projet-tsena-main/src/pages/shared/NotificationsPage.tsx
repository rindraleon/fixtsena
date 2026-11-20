import { useSearchParams, Link } from 'react-router-dom';
import { Bell, BellOff, Check, CheckCheck, ExternalLink, MessageSquare, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useNotifications, useNotificationsUnreadCount } from '../../hooks/queries/useNotifications';
import { useMarkAllNotificationsRead, useMarkNotificationRead } from '../../hooks/mutations/useNotificationMutations';
import { Button, EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import { formatDateTime, formatRelativeDate } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/media';
import {
  isMessageNotification,
  notificationActionLabel,
  notificationDescription,
  notificationHref,
} from '../../lib/notifications';
import type { ApiNotification } from '../../types/api';

interface NotificationsPageProps {
  readonly role: 'client' | 'seller';
}

const PAGE_SIZE = 20;

function notificationTone(type: string): string {
  if (type.includes('fail') || type.includes('dispute') || type.includes('refund') || type.includes('suspend') || type.includes('rejected')) return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  if (type.includes('paid') || type.includes('success') || type.includes('released') || type.includes('activated') || type.includes('delivered') || type.includes('approved')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (type.includes('message')) return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
  if (type.includes('promo') || type.includes('marketing') || type.includes('new_product')) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-primary/10 text-primary';
}

export default function NotificationsPage({ role }: NotificationsPageProps) {
  useTitle(role === 'seller' ? 'Notifications | Vendeur' : 'Notifications | Mon compte');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const unreadOnly = searchParams.get('filter') === 'unread';

  const notificationsQuery = useNotifications({ page, limit: PAGE_SIZE, unread: unreadOnly || undefined });
  const unreadQuery = useNotificationsUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = notificationsQuery.data?.items ?? [];
  const meta = notificationsQuery.data?.meta;
  const unread = unreadQuery.data?.count ?? 0;

  const setFilter = (value: 'all' | 'unread') => {
    const next = new URLSearchParams();
    if (value === 'unread') next.set('filter', 'unread');
    setSearchParams(next, { replace: true });
  };

  const open = (n: ApiNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
  };

  const renderCard = (n: ApiNotification) => {
    const unreadItem = !n.readAt;
    const message = isMessageNotification(n);
    const href = notificationHref(n, role);
    const Icon = message ? MessageSquare : Bell;

    const content = (
      <>
        <span className={clsx('rounded-full flex items-center justify-center shrink-0 overflow-hidden', message ? 'w-10 h-10' : 'w-9 h-9', notificationTone(n.type))} aria-hidden="true">
          {message && n.senderAvatarUrl
            ? <img src={resolveMediaUrl(n.senderAvatarUrl)} alt="" className="w-full h-full object-cover" />
            : <Icon size={message ? 18 : 16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={clsx('text-sm truncate', unreadItem ? 'font-bold text-text' : 'font-medium text-text')}>{n.title}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span
                className={clsx('hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full', unreadItem ? 'bg-primary/10 text-primary' : 'bg-surface-secondary text-muted')}
                data-testid="notification-read-status"
              >
                {unreadItem ? 'Non lue' : 'Lue'}
              </span>
              <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="text-[11px] text-muted">{formatRelativeDate(n.createdAt)}</time>
            </span>
          </span>

          <span className="block text-sm text-muted mt-0.5 line-clamp-2">{notificationDescription(n)}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="text-[11px] text-muted">{formatDateTime(n.createdAt)}</span>
            {href && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                {notificationActionLabel(n)} <ExternalLink size={11} />
              </span>
            )}
            {unreadItem && <span className="sr-only">Notification non lue</span>}
          </span>
        </span>
        {unreadItem && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" aria-label="Non lue" />}
      </>
    );

    const className = clsx(
      'flex gap-3 w-full text-left rounded-xl border p-3.5 transition-colors',
      unreadItem ? 'bg-primary/5 border-primary/20' : 'bg-surface border-border',
      href && 'hover:border-primary/40',
    );

    return (
      <li key={n.id} data-testid="notification-item" data-unread={unreadItem}>
        {href ? (
          <Link to={href} onClick={() => open(n)} className={className}>{content}</Link>
        ) : (
          <div className={clsx(className, 'items-start')}>
            {content}
            {unreadItem && (
              <button
                type="button"
                onClick={() => open(n)}
                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-secondary shrink-0"
                aria-label="Marquer comme lue"
              >
                <Check size={14} />
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Vous êtes à jour'}
        actions={
          <div className="flex items-center gap-2">
            <Link to={role === 'seller' ? '/dashboard/vendeur/boutique' : '/dashboard/client/profil'} className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary"><Settings2 size={14} /> Préférences e-mail</Link>
            <Button variant="outline" size="sm" icon={CheckCheck} onClick={() => markAll.mutate()} loading={markAll.isPending} loadingLabel="Marquage..." disabled={unread === 0} data-testid="notifications-mark-all">Tout marquer comme lu</Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4" role="tablist" aria-label="Filtrer les notifications">
        {([['all', 'Toutes'], ['unread', 'Non lues']] as const).map(([key, label]) => {
          const active = (key === 'unread') === unreadOnly;
          return (
            <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setFilter(key)} className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', active ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:text-text')}>
              {label}{key === 'unread' && unread > 0 ? ` (${unread})` : ''}
            </button>
          );
        })}
      </div>

      {notificationsQuery.isPending ? (
        <LoadingState variant="list" count={5} />
      ) : notificationsQuery.isError ? (
        <ErrorState error={notificationsQuery.error} onRetry={() => void notificationsQuery.refetch()} retrying={notificationsQuery.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState icon={unreadOnly ? BellOff : Bell} title={unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'} description="Les étapes de vos commandes, messages, avis et nouveautés des boutiques suivies apparaîtront ici." />
      ) : (
        <ul className={clsx('space-y-2', notificationsQuery.isFetching && 'opacity-70')} data-testid="notifications-list">
          {items.map(renderCard)}
        </ul>
      )}
      {meta && meta.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => { const next = new URLSearchParams(searchParams); next.set('page', String(p)); setSearchParams(next, { replace: true }); }} />
      )}
    </div>
  );
}
