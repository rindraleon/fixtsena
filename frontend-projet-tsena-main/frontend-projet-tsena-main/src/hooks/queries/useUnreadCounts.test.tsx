import { useMessagingUnreadCount } from './useMessaging';
import { useNotificationsUnreadCount } from './useNotifications';
import { callsTo } from '../../test/mock-backend';
import { renderWithProviders } from '../../test/render';

function UnreadCounts() {
  useMessagingUnreadCount();
  useNotificationsUnreadCount();
  return null;
}

describe('unread count queries', () => {
  it('does not request protected counts without an authenticated session', async () => {
    renderWithProviders(<UnreadCounts />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(callsTo('GET', '/conversations/unread-count')).toHaveLength(0);
    expect(callsTo('GET', '/notifications/unread-count')).toHaveLength(0);
  });
});
