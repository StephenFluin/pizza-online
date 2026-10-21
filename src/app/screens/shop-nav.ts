import { ICONS, Tool } from '../shell/shell.service';

/**
 * Changing pizzeria works one way everywhere: the Prev shop and Next shop
 * buttons in the bottom row of the tool grid. The choice is shared through
 * `UiService.shopId`, so every screen about one pizzeria shows the same one.
 */

/** The pizzeria `delta` places along the list, wrapping round. */
export function cycleShop(
  ids: readonly number[],
  current: number | null | undefined,
  delta: number,
): number | null {
  if (ids.length === 0) return null;
  const i = Math.max(0, ids.indexOf(current ?? -1));
  return ids[(i + delta + ids.length) % ids.length];
}

/** Prev shop and Next shop for the tool grid. */
export function shopCycleTools(
  ids: readonly number[],
  current: number | null | undefined,
  go: (id: number) => void,
): Tool[] {
  const step = (delta: number) => () => {
    const id = cycleShop(ids, current, delta);
    if (id !== null) go(id);
  };
  return [
    {
      id: 'prev-shop',
      label: 'Prev shop',
      icon: ICONS.left,
      disabled: ids.length < 2,
      action: step(-1),
    },
    {
      id: 'next-shop',
      label: 'Next shop',
      icon: ICONS.right,
      disabled: ids.length < 2,
      action: step(1),
    },
  ];
}
