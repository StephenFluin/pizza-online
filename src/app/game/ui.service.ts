import { Injectable, signal } from '@angular/core';
import { StoreKind } from './furniture';
import { Recipe } from './model';

export type Dialog =
  | { kind: 'cookbook' }
  | { kind: 'designer'; recipe: Recipe; isNew: boolean }
  | { kind: 'world' }
  | { kind: 'bank' }
  | { kind: 'saves' }
  | { kind: 'restaurants' }
  | { kind: 'finances' }
  | { kind: 'news' }
  | { kind: 'phone' }
  | { kind: 'interior'; restaurantId: number; placeItemId?: string }
  | { kind: 'report' }
  | { kind: 'stock'; restaurantId?: number }
  | { kind: 'shop'; restaurantId: number; storeKind?: StoreKind }
  | { kind: 'staff'; restaurantId?: number }
  | { kind: 'incident' }
  | { kind: 'contest' }
  | { kind: 'capacity'; restaurantId?: number }
  | { kind: 'warehouse'; cityId?: string }
  | { kind: 'underworld' }
  | { kind: 'ending' }
  | { kind: 'highscores' };

/** The map's folder tabs: plain map, district boundaries, or which chain controls each district. */
export type MapOverlay = 'none' | 'districts' | 'control' | 'wealth' | 'competition';

/** Toggle buttons above the map that highlight things on it. */
export type MapMarker = 'player' | 'range' | 'locations' | 'properties';

/** Which modal dialog is open. Only one dialog is shown at a time. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly dialog = signal<Dialog | null>(null);
  readonly overlay = signal<MapOverlay>('none');
  readonly markers = signal<ReadonlySet<MapMarker>>(new Set(['properties']));
  /** District under the mouse pointer on the city map, for the info panel. */
  readonly hoverDistrict = signal<string | null>(null);

  toggleMarker(m: MapMarker): void {
    this.markers.update((s) => {
      const next = new Set(s);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  open(dialog: Dialog): void {
    this.dialog.set(dialog);
  }

  close(): void {
    this.dialog.set(null);
  }
}
