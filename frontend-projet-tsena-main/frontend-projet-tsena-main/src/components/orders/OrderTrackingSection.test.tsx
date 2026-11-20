import { describe, expect, it } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderTrackingSection, { historyLabel } from './OrderTrackingSection';
import { renderWithProviders } from '../../test/render';
import { callsTo, envelope, mockRoute } from '../../test/mock-backend';
import type { ApiOrder } from '../../types/api';

const ORDER: ApiOrder = {
  id: 'o-1',
  orderNumber: 'TS-20261003-TEST',
  buyerId: 'u-buyer',
  sellerId: 'u-seller',
  buyer: null,
  seller: null,
  subtotalAmount: 120000,
  shippingAmount: 0,
  totalAmount: 120000,
  status: 'shipped',
  lines: [],
  shippingAddress: {
    recipientName: 'Rakoto Acheteur',
    phone: '034 12 345 67',
    street: 'Lot II M 45 Ankadifotsy',
    complement: null,
    city: 'Antananarivo',
    state: 'Analamanga',
    postalCode: '101',
    country: 'Madagascar',
    instructions: 'Portail vert',
  },
  delivery: {
    id: 'd-1',
    orderId: 'o-1',
    status: 'in_transit',
    trackingNumber: 'CE-2026-0001',
    carrier: 'Colis Express',
    method: 'Livreur',
    note: 'Pris en charge au dépôt',
    shippedAt: '2026-10-03T08:00:00.000Z',
    deliveredAt: null,
    receptionConfirmedAt: null,
    estimatedDeliveryAt: '2026-10-06T10:00:00.000Z',
    createdAt: '2026-10-03T08:00:00.000Z',
    updatedAt: '2026-10-03T09:00:00.000Z',
  },
  history: [
    {
      id: 'h-1',
      orderId: 'o-1',
      fromStatus: null,
      toStatus: 'pending',
      actorId: 'u-buyer',
      actorRole: 'buyer',
      comment: null,
      metadata: null,
      createdAt: '2026-10-02T10:00:00.000Z',
    },
    {
      id: 'h-2',
      orderId: 'o-1',
      fromStatus: 'processing',
      toStatus: 'shipped',
      actorId: 'u-seller',
      actorRole: 'seller',
      comment: 'Expédié via Colis Express',
      metadata: null,
      createdAt: '2026-10-03T08:00:00.000Z',
    },
    {
      id: 'h-3',
      orderId: 'o-1',
      fromStatus: 'delivery:shipped',
      toStatus: 'delivery:in_transit',
      actorId: 'u-seller',
      actorRole: 'seller',
      comment: 'Pris en charge au dépôt',
      metadata: { scope: 'delivery' },
      createdAt: '2026-10-03T09:00:00.000Z',
    },
  ],
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-03T09:00:00.000Z',
};

describe('historyLabel', () => {
  it('traduit les statuts de commande et les événements de livraison préfixés', () => {
    expect(historyLabel(null)).toBe('Création');
    expect(historyLabel('shipped')).toBe('Expédiée');
    expect(historyLabel('delivery:in_transit')).toBe('Livraison · En transit');
  });
});

describe('OrderTrackingSection — suivi de livraison (F-ACH-08 / F-LIV-06)', () => {
  it('affiche pour l’acheteur l’adresse figée, le transporteur, le n° de suivi et l’historique, sans actions vendeur', () => {
    renderWithProviders(<OrderTrackingSection order={ORDER} role="client" />);
    expect(
      within(screen.getByTestId('order-shipping-address')).getByText(/Lot II M 45 Ankadifotsy/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('delivery-status')).toHaveTextContent('En transit');
    expect(screen.getByText('CE-2026-0001')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('order-tracking')).getByText(/Colis Express · Livreur/),
    ).toBeInTheDocument();
    const history = screen.getByTestId('order-history');
    expect(within(history).getAllByRole('listitem')).toHaveLength(3);
    expect(within(history).getByText('Livraison · En transit')).toBeInTheDocument();
    expect(screen.queryByTestId('delivery-actions')).not.toBeInTheDocument();
  });

  it('permet au vendeur de déclarer un événement d’acheminement après confirmation', async () => {
    mockRoute(
      'PATCH',
      '/orders/o-1/delivery',
      envelope(
        { ...ORDER, delivery: { ...ORDER.delivery!, status: 'delivered' } },
        'Suivi de livraison mis à jour',
      ),
    );
    renderWithProviders(<OrderTrackingSection order={ORDER} role="seller" />);
    await userEvent.click(screen.getByTestId('delivery-action-delivered'));
    expect(callsTo('PATCH', '/orders/o-1/delivery')).toHaveLength(0);
    const dialog = await screen.findByRole('alertdialog');
    // `fireEvent.change` : la boîte de dialogue déplace le focus à l'ouverture, la saisie caractère par caractère serait fragile.
    fireEvent.change(within(dialog).getByTestId('delivery-note'), {
      target: { value: 'Remis au gardien' },
    });
    await waitFor(() =>
      expect(within(dialog).getByTestId('delivery-note')).toHaveValue('Remis au gardien'),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: /^colis remis$/i }));
    await waitFor(() => expect(callsTo('PATCH', '/orders/o-1/delivery')).toHaveLength(1));
    expect(callsTo('PATCH', '/orders/o-1/delivery')[0]?.body).toMatchObject({
      status: 'delivered',
      comment: 'Remis au gardien',
    });
  });

  it('exige un motif pour un échec de livraison', async () => {
    renderWithProviders(<OrderTrackingSection order={ORDER} role="seller" />);
    await userEvent.click(screen.getByTestId('delivery-action-delivery_failed'));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^échec de livraison$/i }));
    expect(callsTo('PATCH', '/orders/o-1/delivery')).toHaveLength(0);
    expect(within(dialog).getByText(/précisez le motif pour l’acheteur\.$/i)).toBeInTheDocument();
  });
});
