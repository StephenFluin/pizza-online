import { Component, computed, inject } from '@angular/core';
import { GameService } from '../game/game.service';
import { formatDate } from '../game/model';

/** The full news log, newest first. */
@Component({
  selector: 'app-news-dialog',
  template: `
    <ol class="log">
      @for (m of messages(); track $index) {
        <li><span class="when">{{ m.when }}</span> {{ m.text }}</li>
      }
    </ol>
  `,
  styles: `
    .log { list-style: none; padding: 0; margin: 0; max-height: 60dvh; overflow: auto; min-width: min(480px, 80vw); }
    .log li { padding: 6px 0; border-top: 1px solid var(--line); }
    .when { font-weight: 700; margin-right: 6px; }
  `,
})
export class NewsDialogComponent {
  private readonly game = inject(GameService);
  protected readonly messages = computed(() =>
    [...(this.game.state()?.messages ?? [])].reverse().map((m) => ({ when: formatDate(m.day), text: m.text })),
  );
}
