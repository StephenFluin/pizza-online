import { Injectable, signal } from '@angular/core';
import { Recipe } from './model';

export type Dialog =
  | { kind: 'cookbook' }
  | { kind: 'designer'; recipe: Recipe; isNew: boolean }
  | { kind: 'world' }
  | { kind: 'bank' }
  | { kind: 'saves' }
  | { kind: 'restaurants' }
  | { kind: 'finances' }
  | { kind: 'news' };

export type MapOverlay = 'none' | 'districts' | 'wealth' | 'competition';

/** Which modal dialog is open. Only one dialog is shown at a time. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly dialog = signal<Dialog | null>(null);
  readonly overlay = signal<MapOverlay>('none');

  open(dialog: Dialog): void {
    this.dialog.set(dialog);
  }

  close(): void {
    this.dialog.set(null);
  }
}
