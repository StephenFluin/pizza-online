import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { formatDate } from '../game/model';
import { conditions, trendNotes } from '../game/newspaper';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

type Section = 'front' | 'charts' | 'business';

/** The city's daily paper: front-page events, the pizza charts and business news. */
@Component({
  selector: 'app-news-dialog',
  template: `
    <article class="paper">
      <header class="masthead">
        <span>{{ date() }}</span>
        <h3>The {{ city() }} Courier</h3>
        <span>{{ economyLabel() }}</span>
      </header>
      <nav class="sections" aria-label="Sections">
        <button type="button" [attr.aria-pressed]="section() === 'front'" (click)="section.set('front')">Front page</button>
        <button type="button" [attr.aria-pressed]="section() === 'charts'" (click)="section.set('charts')">Pizza charts</button>
        <button type="button" [attr.aria-pressed]="section() === 'business'" (click)="section.set('business')">Business</button>
      </nav>

      @switch (section()) {
        @case ('front') {
          <div class="front">
            <div class="stories">
              @for (a of articles(); track $index; let first = $first) {
                <section class="story" [class.lead]="first">
                  <h4>{{ a.title }}</h4>
                  <p>{{ a.body }}</p>
                </section>
              } @empty {
                <section class="story lead"><h4>A quiet day in {{ city() }}</h4><p>Nothing much to report. Ovens are warm and the streets are calm.</p></section>
              }
            </div>
            <aside class="column">
              <h4>Food fashions</h4>
              <ul>
                @for (t of trends(); track t) {<li>{{ t }}</li>} @empty {<li>No fads this week.</li>}
              </ul>
              <h4>Top pizzas this week</h4>
              <ol>
                @for (c of charts(); track $index) {<li>{{ c.recipeName }} <small>({{ c.owner }}, {{ c.sold }})</small></li>} @empty {<li>Charts out on Monday.</li>}
              </ol>
            </aside>
          </div>
        }
        @case ('charts') {
          <table class="charts">
            <caption>Best-selling pizzas in {{ city() }}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Pizza</th><th scope="col">Chain</th><th scope="col">Sold</th></tr></thead>
            <tbody>
              @for (c of charts(); track $index; let i = $index) {
                <tr><td>{{ i + 1 }}</td><th scope="row">{{ c.recipeName }}</th><td>{{ c.owner }}</td><td>{{ c.sold }}</td></tr>
              } @empty {
                <tr><td colspan="4">The charts are printed every Monday.</td></tr>
              }
            </tbody>
          </table>
        }
        @case ('business') {
          <ol class="log">
            @for (m of messages(); track $index) {
              <li><span class="when">{{ m.when }}</span> {{ m.text }}</li>
            }
          </ol>
        }
      }
    </article>
  `,
  styles: `
    .paper { background: #f4f1e8; color: #222; font-family: Georgia, 'Times New Roman', serif; padding: 16px 20px; box-shadow: 4px 6px 0 #0002; max-width: 900px; margin: 0 auto; }
    .masthead { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; border-bottom: 4px double #222; padding-bottom: 6px; }
    .masthead span:last-child { text-align: right; }
    .masthead h3 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.6rem); letter-spacing: 0.04em; text-align: center; }
    .sections { display: flex; gap: 6px; margin: 8px 0 12px; border-bottom: 1px solid #222; padding-bottom: 6px; }
    .sections button { background: none; color: #222; border: 1px solid #222; font-family: inherit; font-weight: 400; padding: 2px 10px; }
    .sections button[aria-pressed='true'] { background: #222; color: #f4f1e8; }
    .front { display: grid; grid-template-columns: 1fr 220px; gap: 18px; }
    .stories { columns: 2 220px; column-gap: 18px; column-rule: 1px solid #bbb; }
    .story { break-inside: avoid; margin-bottom: 12px; }
    .story h4 { margin: 0 0 4px; font-size: 1.1rem; }
    .story.lead h4 { font-size: 1.6rem; }
    .story p { margin: 0; text-align: justify; }
    .column { border-left: 1px solid #bbb; padding-left: 14px; }
    .column h4 { margin: 0 0 4px; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.06em; }
    .column ul, .column ol { margin: 0 0 12px; padding-left: 18px; }
    .charts { width: 100%; border-collapse: collapse; }
    .charts caption { text-align: left; font-weight: 700; margin-bottom: 6px; }
    .charts th, .charts td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #ccc; }
    .log { list-style: none; padding: 0; margin: 0; }
    .log li { padding: 6px 0; border-top: 1px solid #ccc; }
    .when { font-weight: 700; margin-right: 6px; }
    @media (max-width: 760px) { .front { grid-template-columns: 1fr; } .column { border-left: none; padding-left: 0; } }
  `,
})
export class NewsDialogComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  protected readonly section = signal<Section>('front');

  private readonly cityId = computed(() => this.game.state()?.currentCityId ?? 'rome');
  protected readonly city = computed(() => cityDef(this.cityId()).name);
  protected readonly date = computed(() => formatDate(this.game.state()?.day ?? 0));
  protected readonly articles = computed(() => {
    const paper = this.game.state()?.newspaper;
    return paper && paper.cityId === this.cityId() ? paper.articles : [];
  });
  protected readonly charts = computed(() => this.game.state()?.charts?.[this.cityId()] ?? []);
  protected readonly trends = computed(() => {
    const st = this.game.state();
    return st ? trendNotes(st, this.cityId()) : [];
  });
  protected readonly economyLabel = computed(() => {
    const st = this.game.state();
    const e = st ? conditions(st, this.cityId()).economy : 0;
    return e > 0.4 ? 'Economy: booming' : e > 0.1 ? 'Economy: growing' : e > -0.1 ? 'Economy: steady' : e > -0.4 ? 'Economy: tight' : 'Economy: slump';
  });
  protected readonly messages = computed(() =>
    [...(this.game.state()?.messages ?? [])].reverse().map((m) => ({ when: formatDate(m.day), text: m.text })),
  );

  private readonly lines = computed<LcdLine[]>(() => [{ label: 'Newspaper' }, { label: this.city() }, { label: this.economyLabel() }, { label: 'Fads', value: String(this.trends().length) }]);
  private readonly tools = computed<Tool[]>(() => [
    { id: 'front', label: 'Front page', icon: ICONS.news, pressed: this.section() === 'front', action: () => this.section.set('front') },
    { id: 'charts', label: 'Charts', icon: ICONS.chart, pressed: this.section() === 'charts', action: () => this.section.set('charts') },
    { id: 'business', label: 'Business', icon: ICONS.book, pressed: this.section() === 'business', action: () => this.section.set('business') },
    { id: 'back', label: 'Back', icon: ICONS.back, action: () => (this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close()) },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }
}
