import { describe, expect, it } from 'vitest';
import {
  auditActionLabel,
  applicationStatusLabel,
  deliveryStatusLabel,
  orderStatusLabel,
  restaurantStatusLabel,
  settlementStatusLabel,
} from './domainStatus';

describe('domain status localization', () => {
  it('never exposes application database codes in Arabic', () => {
    expect(applicationStatusLabel('ready_to_publish', 'ar')).toBe('جاهزة للنشر');
    expect(applicationStatusLabel('changes_requested', 'ar')).not.toContain('_');
  });

  it('localizes restaurant and settlement status consistently', () => {
    expect(restaurantStatusLabel('pending_approval', 'fr')).toBe('En attente d’approbation');
    expect(settlementStatusLabel('partially_paid', 'ar')).toBe('مدفوعة جزئيا');
  });

  it('covers customer order and driver delivery states', () => {
    expect(orderStatusLabel('out_for_delivery', 'fr')).toBe('En livraison');
    expect(deliveryStatusLabel('picking_up', 'ar')).toBe('في الطريق إلى المطعم');
  });

  it('turns audit event codes into owner-readable localized actions', () => {
    expect(auditActionLabel('restaurant_published', 'ar')).toBe('تم نشر المطعم');
    expect(auditActionLabel('rule_override_set', 'fr')).toBe('Exception de règle enregistrée');
    expect(auditActionLabel('future_event', 'en')).toBe('future event');
  });
});
