import type {
  MenuItemModifier,
  ModifierOption,
  SelectedModifierOption,
} from './supabase';

export type ModifierGroup = MenuItemModifier & { options: ModifierOption[] };

export type ModifierSelectionValidation = {
  valid: boolean;
  invalidGroupId: string | null;
  reason: 'required' | 'minimum' | 'maximum' | 'invalid_option' | null;
};

export function buildModifierGroups(
  modifiers: MenuItemModifier[],
  options: ModifierOption[],
): ModifierGroup[] {
  return modifiers
    .filter((modifier) => modifier.is_active)
    .sort((a, b) => a.position - b.position)
    .map((modifier) => ({
      ...modifier,
      options: options
        .filter((option) => option.modifier_id === modifier.id && option.is_available)
        .sort((a, b) => a.position - b.position),
    }));
}

export function defaultModifierOptionIds(groups: ModifierGroup[]): string[] {
  return groups.flatMap((group) => {
    const defaults = group.options.filter((option) => option.is_default);
    const maximum = group.is_multiple ? (group.max_select ?? defaults.length) : 1;
    return defaults.slice(0, Math.max(maximum, 0)).map((option) => option.id);
  });
}

export function validateModifierSelection(
  groups: ModifierGroup[],
  selectedOptionIds: string[],
): ModifierSelectionValidation {
  if (new Set(selectedOptionIds).size !== selectedOptionIds.length) {
    return { valid: false, invalidGroupId: null, reason: 'invalid_option' };
  }

  const allowed = new Set(groups.flatMap((group) => group.options.map((option) => option.id)));
  if (selectedOptionIds.some((id) => !allowed.has(id))) {
    return { valid: false, invalidGroupId: null, reason: 'invalid_option' };
  }

  for (const group of groups) {
    const count = group.options.filter((option) => selectedOptionIds.includes(option.id)).length;
    const minimum = Math.max(group.is_required ? 1 : 0, group.min_select);
    const maximum = group.is_multiple ? (group.max_select ?? group.options.length) : 1;
    if (count < minimum) {
      return {
        valid: false,
        invalidGroupId: group.id,
        reason: minimum === 1 ? 'required' : 'minimum',
      };
    }
    if (count > maximum) {
      return { valid: false, invalidGroupId: group.id, reason: 'maximum' };
    }
  }

  return { valid: true, invalidGroupId: null, reason: null };
}

export function selectedModifierOptions(
  groups: ModifierGroup[],
  selectedOptionIds: string[],
): SelectedModifierOption[] {
  const selected = new Set(selectedOptionIds);
  return groups.flatMap((group) =>
    group.options
      .filter((option) => selected.has(option.id))
      .map((option) => ({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceAdjustment: Number(option.price_adjustion),
      })),
  );
}

export function modifierPriceTotal(options: SelectedModifierOption[]): number {
  return options.reduce((total, option) => total + option.priceAdjustment, 0);
}

export function cartLineId(
  menuItemId: string,
  options: Pick<SelectedModifierOption, 'optionId'>[] = [],
  notes = '',
): string {
  const optionKey = options.map((option) => option.optionId).sort().join('.');
  const noteKey = notes.trim().toLocaleLowerCase();
  return `${menuItemId}:${optionKey}:${noteKey}`;
}
