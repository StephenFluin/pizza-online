import { Injectable, Signal, computed, signal } from '@angular/core';

/** One button in the 3×3 tool grid. Icons are SVG path data on a 24×24 grid. */
export interface Tool {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  pressed?: boolean;
  disabled?: boolean;
}

/** A line on the amber info panel: either a heading or a label/value pair. */
export interface LcdLine {
  label: string;
  value?: string;
}

export interface ShellContent {
  lines: Signal<LcdLine[]>;
  tools: Signal<Tool[]>;
}

/**
 * The right-hand column of the classic frame (info panel + tool grid) belongs to
 * whichever full-screen view is active. Views register their content and the most
 * recent registration wins until it is removed.
 */
@Injectable({ providedIn: 'root' })
export class ShellService {
  private readonly stack = signal<{ owner: object; content: ShellContent }[]>([]);
  readonly active = computed(() => this.stack().at(-1)?.content ?? null);

  register(owner: object, content: ShellContent): () => void {
    this.stack.update((s) => [...s.filter((e) => e.owner !== owner), { owner, content }]);
    return () => this.stack.update((s) => s.filter((e) => e.owner !== owner));
  }
}

/** Shared icon paths (original line icons). */
export const ICONS = {
  back: 'M10 5 3 12l7 7M3 12h18',
  world: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  plane: 'M2 13l8-2 4-8h2l-2 8 6 1 2-2h1l-1 4 1 4h-1l-2-2-6 1 2 8h-2l-4-8-8-2z',
  phone:
    'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  restaurant: 'M3 10h18l-2-6H5zM4 10v10h16V10M9 20v-5h6v5',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  book: 'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  megaphone: 'M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M6 13l1 6h3l-1-5',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 13h7M7 16h4',
  disk: 'M5 3h12l3 3v15H4V3zM8 3v5h8V3M7 21v-7h10v7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3',
  pause: 'M8 5v14M16 5v14',
  shop: 'M4 7h16l-1 13H5zM8 7a4 4 0 0 1 8 0',
  staff:
    'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0',
  menu: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15',
  rotate: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  left: 'M19 12H5M12 5l-7 7 7 7',
  right: 'M5 12h14M12 5l7 7-7 7',
  pencil: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  save: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  zoom: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM15 15l6 6',
  pizza: 'M12 2 3 20h18zM9 13h.01M13 10h.01M12 16h.01',
  export: 'M12 3v12M7 8l5-5 5 5M4 15v5h16v-5',
  import: 'M12 15V3M7 10l5 5 5-5M4 15v5h16v-5',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M4 4l2 2M18 18l2 2M1 12h3M20 12h3M4 20l2-2M18 6l2-2',
} as const;
