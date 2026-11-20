import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisputeFormDialog from './DisputeFormDialog';
import { renderWithProviders } from '../../test/render';
import { callsTo, envelope, mockRoute } from '../../test/mock-backend';

describe('DisputeFormDialog — signalement avec motif normalisé (F-LIT-01/02)', () => {
  it('exige un motif de la liste et une description, puis envoie reasonCode + reason', async () => {
    mockRoute('POST', '/disputes', envelope({ id: 'd-1', orderId: 'o-1', reporterId: 'u-1', reason: 'x', reasonCode: 'product_damaged', status: 'reported', createdAt: '', updatedAt: '', orderNumber: 'TS-1', buyerId: null, sellerId: null, orderTotal: null, reporter: null, buyer: null, seller: null }, 'Litige créé avec succès'));
    renderWithProviders(<DisputeFormDialog open onClose={() => undefined} orderId="o-1" orderNumber="TS-20261003-TEST" />);
    const dialog = screen.getByRole('dialog');
    const select = within(dialog).getByTestId('dispute-reason-code') as HTMLSelectElement;
    // Les 11 motifs du cahier des charges + l'option vide
    expect(select.options).toHaveLength(12);
    expect(Array.from(select.options).map((o) => o.text)).toEqual(expect.arrayContaining(['Produit non reçu', 'Produit endommagé', 'Quantité incorrecte', 'Paiement contesté', 'Autre']));

    await userEvent.click(within(dialog).getByTestId('dispute-submit'));
    expect(callsTo('POST', '/disputes')).toHaveLength(0);
    expect(within(dialog).getByText(/choisissez le motif principal/i)).toBeInTheDocument();

    await userEvent.selectOptions(select, 'product_damaged');
    await userEvent.type(within(dialog).getByLabelText(/description du problème/i), 'Écran fissuré à la réception, emballage enfoncé sur un angle.');
    await userEvent.click(within(dialog).getByTestId('dispute-submit'));
    await waitFor(() => expect(callsTo('POST', '/disputes')).toHaveLength(1));
    expect(callsTo('POST', '/disputes')[0]?.body).toMatchObject({ orderId: 'o-1', reasonCode: 'product_damaged', reason: expect.stringContaining('Écran fissuré') });
  });
});
