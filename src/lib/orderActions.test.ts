import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callUserActionMock } = vi.hoisted(() => ({
  callUserActionMock: vi.fn(),
}));

vi.mock('./userApi', () => ({
  callUserAction: callUserActionMock,
}));

import { requestCustomerCancellation } from './orderActions';

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  customer_id: '22222222-2222-4222-8222-222222222222',
  restaurant_id: '33333333-3333-4333-8333-333333333333',
  status: 'pending' as const,
  updated_at: '2026-07-26T18:00:00.000Z',
};

beforeEach(() => {
  callUserActionMock.mockReset();
});

describe('customer cancellation', () => {
  it('uses the canonical transition while the order is still pending', async () => {
    callUserActionMock.mockResolvedValueOnce({
      data: { id: order.id },
      error: null,
    });

    await expect(requestCustomerCancellation(order, 'en')).resolves.toEqual({
      status: 'cancelled',
    });
    expect(callUserActionMock).toHaveBeenCalledTimes(1);
    expect(callUserActionMock).toHaveBeenCalledWith('transition_order_status', {
      p_order_id: order.id,
      p_target_status: 'cancelled',
      p_reason: 'Customer cancelled before restaurant preparation',
      p_expected_updated_at: order.updated_at,
    });
  });

  it('routes later cancellation requests through secure order support', async () => {
    callUserActionMock.mockResolvedValueOnce({
      data: { id: '44444444-4444-4444-8444-444444444444' },
      error: null,
    });

    await expect(requestCustomerCancellation({
      ...order,
      status: 'preparing',
    }, 'fr')).resolves.toEqual({ status: 'support_created' });

    expect(callUserActionMock).toHaveBeenCalledWith('create_support_ticket', {
      p_subject: 'Demande d’annulation de la commande #11111111',
      p_body: 'L’annulation automatique n’était plus disponible. Merci de vérifier rapidement cette commande et d’aider le client.',
      p_category: 'complaint',
      p_priority: 'normal',
      p_order_id: order.id,
    });
  });

  it('falls back to support if a pending order changed concurrently', async () => {
    callUserActionMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: '40001', message: 'The order changed.' },
      })
      .mockResolvedValueOnce({
        data: { id: '44444444-4444-4444-8444-444444444444' },
        error: null,
      });

    await expect(requestCustomerCancellation(order, 'ar')).resolves.toEqual({
      status: 'support_created',
    });
    expect(callUserActionMock).toHaveBeenNthCalledWith(2, 'create_support_ticket', expect.objectContaining({
      p_order_id: order.id,
      p_priority: 'high',
    }));
  });
});
