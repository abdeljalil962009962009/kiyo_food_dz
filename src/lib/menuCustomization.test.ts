import { describe, expect, it } from 'vitest';
import {
  buildModifierGroups,
  cartLineId,
  defaultModifierOptionIds,
  modifierPriceTotal,
  selectedModifierOptions,
  validateModifierSelection,
} from './menuCustomization';
import type { MenuItemModifier, ModifierOption } from './supabase';

const modifiers: MenuItemModifier[] = [{
  id: 'size',
  menu_item_id: 'dish',
  name: 'Size',
  is_required: true,
  is_multiple: false,
  min_select: 1,
  max_select: 1,
  position: 0,
  is_active: true,
  created_at: '',
}, {
  id: 'extras',
  menu_item_id: 'dish',
  name: 'Extras',
  is_required: false,
  is_multiple: true,
  min_select: 0,
  max_select: 2,
  position: 1,
  is_active: true,
  created_at: '',
}];

const options: ModifierOption[] = [
  { id: 'small', modifier_id: 'size', name: 'Small', price_adjustion: '0', is_default: true, is_available: true, position: 0, created_at: '' },
  { id: 'large', modifier_id: 'size', name: 'Large', price_adjustion: '150', is_default: false, is_available: true, position: 1, created_at: '' },
  { id: 'cheese', modifier_id: 'extras', name: 'Cheese', price_adjustion: '50', is_default: false, is_available: true, position: 0, created_at: '' },
  { id: 'sauce', modifier_id: 'extras', name: 'Sauce', price_adjustion: '25', is_default: false, is_available: true, position: 1, created_at: '' },
];

describe('menu customizations', () => {
  const groups = buildModifierGroups(modifiers, options);

  it('applies safe defaults and validates required and maximum choices', () => {
    expect(defaultModifierOptionIds(groups)).toEqual(['small']);
    expect(validateModifierSelection(groups, [])).toMatchObject({ valid: false, reason: 'required' });
    expect(validateModifierSelection(groups, ['large', 'cheese', 'sauce'])).toMatchObject({ valid: true });
    expect(validateModifierSelection(groups, ['large', 'cheese', 'sauce', 'extra-third'])).toMatchObject({ valid: false, reason: 'invalid_option' });
  });

  it('creates priced snapshots without trusting a caller-supplied total', () => {
    const selected = selectedModifierOptions(groups, ['large', 'cheese']);
    expect(modifierPriceTotal(selected)).toBe(200);
    expect(selected.map((option) => option.optionName)).toEqual(['Large', 'Cheese']);
  });

  it('keeps differently customized versions of a dish as different cart lines', () => {
    const large = selectedModifierOptions(groups, ['large']);
    const small = selectedModifierOptions(groups, ['small']);
    expect(cartLineId('dish', large)).not.toBe(cartLineId('dish', small));
    expect(cartLineId('dish', large, 'no onions')).not.toBe(cartLineId('dish', large));
  });
});
