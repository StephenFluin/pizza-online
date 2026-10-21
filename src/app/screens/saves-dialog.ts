import { Component, inject, signal } from '@angular/core';
import { GameService } from '../game/game.service';
import { formatDate } from '../game/model';
import { SaveSlotInfo, listSlots, serialize } from '../game/saves';
import { UiService } from '../game/ui.service';

/** Save to and load from browser storage, or export/import a save file. Also used on the title screen. */
@Component({
  selector: 'app-saves-dialog',
  template: `
    <ul class="slots">
      @for (s of slots(); track s.slot) {
        <li>
          <span>
            <b>{{ s.label }}</b>
            @if (s.savedAt) {
              · {{ s.player }} · {{ s.date }}
            } @else {
              · empty
            }
          </span>
          <span class="buttons">
            @if (inGame() && s.slot !== 'auto') {
              <button
                type="button"
                class="small"
                (click)="save(s.slot)"
                [attr.aria-label]="'Save to ' + s.label"
              >
                Save
              </button>
            }
            <button
              type="button"
              class="small secondary"
              (click)="load(s.slot)"
              [disabled]="!s.savedAt"
              [attr.aria-label]="'Load ' + s.label"
            >
              Load
            </button>
          </span>
        </li>
      }
    </ul>
    <div class="row">
      @if (inGame()) {
        <button type="button" class="secondary" (click)="exportSave()">Export save file</button>
      }
      <label class="import">
        <span class="as-button secondary">Import save file…</span>
        <input
          type="file"
          accept=".json,application/json"
          class="sr-only"
          (change)="importSave($event)"
        />
      </label>
    </div>
    <p role="status" class="status">{{ status() }}</p>
    @if (inGame()) {
      <div class="row">
        <button type="button" class="secondary" (click)="retire()">
          Retire and record my score
        </button>
        <button type="button" class="secondary" (click)="quit()">Quit to title</button>
      </div>
    }
  `,
  styles: `
    .slots {
      list-style: none;
      padding: 0;
      margin: 0 0 12px;
      min-width: min(460px, 80vw);
    }
    .slots li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-top: 1px solid var(--line);
    }
    .buttons,
    .row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .small {
      padding: 2px 8px;
      font-size: 0.85rem;
    }
    .as-button {
      display: inline-block;
      border: 2px solid var(--tomato);
      color: var(--tomato);
      border-radius: 6px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .import:focus-within .as-button {
      outline: 3px solid #f4a261;
      outline-offset: 2px;
    }
    .status {
      min-height: 1.4em;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class SavesDialogComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  protected readonly slots = signal<SaveSlotInfo[]>(listSlots());
  protected readonly status = signal('');
  protected readonly inGame = () => this.game.state() !== null;

  protected save(slot: string): void {
    const ok = this.game.save(slot);
    this.status.set(ok ? 'Game saved.' : 'Could not save: browser storage is full or unavailable.');
    this.slots.set(listSlots());
  }

  protected load(slot: string): void {
    try {
      if (this.game.load(slot)) this.ui.close();
    } catch {
      this.status.set('That save could not be read.');
    }
  }

  protected exportSave(): void {
    const st = this.game.state();
    if (!st) return;
    const blob = new Blob([serialize(st)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pizza-online-${formatDate(st.day).replace(/ /g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  protected async importSave(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.game.loadFromText(await file.text());
      this.ui.close();
    } catch {
      this.status.set(`${file.name} is not a Pizza Online save file.`);
    }
  }

  protected retire(): void {
    if (confirm('Retire now? Your career ends here and goes on the high-score table.'))
      this.game.retire();
  }

  protected quit(): void {
    if (
      confirm('Quit to the title screen? Unsaved progress since the last autosave will be lost.')
    ) {
      this.ui.close();
      this.game.quit();
    }
  }
}
