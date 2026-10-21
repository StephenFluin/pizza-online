import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  AD_CHANNELS,
  AdChannel,
  FLYER_STEP,
  MAX_CAMPAIGN_DAYS,
  MAX_FLYERS,
  MIN_CAMPAIGN_DAYS,
  MIN_FLYERS,
  NEWSPAPER_FORMATS,
  POSTERS,
  SLOGAN_ROUNDS,
  SloganGame,
  TV_COMMERCIALS,
  audienceFit,
  campaignCost,
  flyerRate,
} from '../game/advertising';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { AdCampaign, formatMoney } from '../game/model';
import { adEffectiveness } from '../game/simulation';
import { ArtCacheService } from '../shell/art-cache.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { POSTER_H, POSTER_W, buildPoster } from './poster-art';
import { TvPlayerComponent } from './tv-player';

/**
 * The advertising office for the current city: four channels, each with at most
 * one campaign, and a purchasing view per channel (print run, poster gallery,
 * slogan game, commercial preview).
 */
@Component({
  selector: 'app-advertising-screen',
  imports: [TvPlayerComponent],
  template: `
    <div class="ads">
      <ul class="channels" aria-label="Advertising channels">
        @for (c of channels; track c.id) {
          <li>
            <button
              type="button"
              class="channel"
              [attr.aria-current]="channel() === c.id"
              (click)="selectChannel(c.id)"
            >
              <b>{{ c.label }}</b>
              @if (running(c.id); as camp) {
                <span
                  >{{ camp.daysLeft }} days · {{ camp.effectiveness }}% ·
                  {{ money(camp.cost) }}</span
                >
              } @else {
                <span class="none">No campaign</span>
              }
            </button>
          </li>
        }
        <li class="total">
          Advertising adds <b>{{ boost() }}</b> popularity points in {{ cityName() }}.
        </li>
      </ul>

      <section class="stage" [attr.aria-label]="channelLabel()">
        @if (current(); as camp) {
          <p class="status">
            Running for {{ camp.daysLeft }} more days at {{ camp.effectiveness }}% effectiveness. A
            new {{ channelLabel().toLowerCase() }} campaign can start when it ends.
          </p>
        }
        @switch (channel()) {
          @case ('flyers') {
            <div class="flyer">
              <h3>{{ company() }}</h3>
              <p>The best pizza in {{ cityName() }}!</p>
              <p class="small">Bring this flyer for a free drink.</p>
            </div>
            @if (!current()) {
              <div class="control">
                <button
                  type="button"
                  class="small"
                  (click)="flyers.set(clampFlyers(flyers() - step))"
                  [disabled]="flyers() <= minFlyers"
                  aria-label="Fewer flyers"
                >
                  −
                </button>
                <span
                  >Print run: <b>{{ flyers() }}</b> flyers</span
                >
                <button
                  type="button"
                  class="small"
                  (click)="flyers.set(clampFlyers(flyers() + step))"
                  [disabled]="flyers() >= maxFlyers"
                  aria-label="More flyers"
                >
                  +
                </button>
              </div>
            }
          }
          @case ('posters') {
            @let p = poster();
            <div class="poster-view">
              @if (!current()) {
                <button
                  type="button"
                  class="arrow"
                  (click)="cyclePoster(-1)"
                  aria-label="Previous poster"
                >
                  ‹
                </button>
              }
              @if (posterImage(); as src) {
                <img
                  [src]="src"
                  [width]="posterW"
                  [height]="posterH"
                  [alt]="'Poster: ' + p.title + ', ' + p.tagline"
                />
              } @else {
                <span
                  class="placeholder"
                  [style.width.px]="posterW"
                  [style.height.px]="posterH"
                ></span>
              }
              @if (!current()) {
                <button
                  type="button"
                  class="arrow"
                  (click)="cyclePoster(1)"
                  aria-label="Next poster"
                >
                  ›
                </button>
              }
            </div>
            <p class="caption">
              <b>{{ p.title }}</b> · {{ fitLabel(p.audience) }} · design {{ p.id + 1 }} of
              {{ posterCount }}
            </p>
          }
          @case ('newspaper') {
            @if (current(); as camp) {
              <div class="paper">
                <p class="masthead">The {{ cityName() }} Courier</p>
                @for (line of camp.slogan ?? []; track $index) {
                  <p>{{ line }}</p>
                }
              </div>
            } @else {
              <div
                class="paper"
                [class.full]="game_().format >= 2"
                [class.color]="game_().format % 2 === 1"
              >
                <p class="masthead">The {{ cityName() }} Courier</p>
                @for (line of slogan(); track $index) {
                  <p>{{ line }}</p>
                }
                @if (!game_().finished) {
                  <p class="cursor">…</p>
                }
              </div>
              @if (!game_().finished) {
                <p class="round">
                  Round {{ game_().round + 1 }} of {{ rounds }}: choose the next part of your
                  advert. Keep it consistent for the best effect.
                </p>
                <div class="fragments">
                  @for (f of game_().options(); track f) {
                    <button type="button" class="fragment" (click)="pickFragment(f)">
                      {{ game_().fragment(f, game_().round, company()) }}
                    </button>
                  }
                </div>
              } @else {
                <div class="control">
                  <button
                    type="button"
                    class="small"
                    (click)="changeFormat(-1)"
                    [disabled]="game_().format === 0"
                    aria-label="Smaller advert"
                  >
                    −
                  </button>
                  <span>{{ formats[game_().format].label }}</span>
                  <button
                    type="button"
                    class="small"
                    (click)="changeFormat(1)"
                    [disabled]="game_().format === formats.length - 1"
                    aria-label="Bigger advert"
                  >
                    +
                  </button>
                  <button type="button" class="small secondary" (click)="restartSlogan()">
                    Write a new slogan
                  </button>
                </div>
              }
              <p class="caption">
                Consistency: <b>{{ game_().multiplier }}%</b>
              </p>
            }
          }
          @case ('tv') {
            @let ad = commercial();
            <app-tv-player [commercial]="ad" />
            <div class="control">
              @if (!current()) {
                <button
                  type="button"
                  class="small"
                  (click)="cycleTv(-1)"
                  aria-label="Previous commercial"
                >
                  ‹
                </button>
              }
              <span
                ><b>{{ ad.title }}</b> · directed by {{ ad.director }} ·
                {{ fitLabel(ad.audience) }}</span
              >
              @if (!current()) {
                <button
                  type="button"
                  class="small"
                  (click)="cycleTv(1)"
                  aria-label="Next commercial"
                >
                  ›
                </button>
              }
            </div>
          }
        }

        @if (!current()) {
          <div class="buy">
            <div class="control">
              <button
                type="button"
                class="small"
                (click)="changeDays(-7)"
                [disabled]="days() <= minDays"
                aria-label="Shorter campaign"
              >
                −
              </button>
              <span
                >Runs for <b>{{ days() }}</b> days</span
              >
              <button
                type="button"
                class="small"
                (click)="changeDays(7)"
                [disabled]="days() >= maxDays"
                aria-label="Longer campaign"
              >
                +
              </button>
            </div>
            <p>
              Effectiveness <b>{{ offer().effectiveness }}%</b> · cost
              <b>{{ money(offer().cost) }}</b>
            </p>
            <button type="button" (click)="buy()" [disabled]="!canBuy()">Buy campaign</button>
            @if (message()) {
              <p role="status">{{ message() }}</p>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .ads {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 16px;
      align-items: start;
    }
    .channels {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .channel {
      width: 100%;
      display: grid;
      text-align: left;
      background: #fffaf0;
      color: var(--ink);
      border: 2px solid var(--line);
      font-weight: 400;
      padding: 8px;
    }
    .channel[aria-current='true'] {
      border-color: var(--wood);
      background: #fff3d6;
    }
    .none {
      color: #666;
    }
    .total {
      font-size: 0.9rem;
      padding: 6px 2px;
    }
    .stage {
      display: grid;
      gap: 12px;
      justify-items: center;
      background: #fffaf0;
      border: 2px solid var(--line);
      padding: 16px;
    }
    .status {
      background: #fff3d6;
      padding: 6px 10px;
      margin: 0;
    }
    .flyer {
      width: 260px;
      aspect-ratio: 3 / 4;
      background: #fffef8;
      box-shadow: 4px 6px 0 #0002;
      padding: 20px;
      text-align: center;
      display: grid;
      align-content: center;
      border: 2px dashed var(--tomato);
      transform: rotate(-2deg);
    }
    .flyer h3 {
      font-family: Georgia, serif;
      font-size: 1.6rem;
      margin: 0 0 12px;
      color: var(--tomato);
    }
    .flyer .small {
      font-size: 0.85rem;
    }
    .poster-view {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .poster-view img,
    .placeholder {
      box-shadow: 4px 6px 0 #0003;
      display: block;
      background: #ddd;
    }
    .arrow {
      font-size: 1.6rem;
      padding: 4px 12px;
    }
    .caption {
      margin: 0;
      text-align: center;
    }
    .paper {
      width: min(420px, 100%);
      background: #f4f1e8;
      border: 1px solid #999;
      padding: 14px 18px;
      font-family: Georgia, serif;
      box-shadow: 4px 6px 0 #0002;
      min-height: 160px;
    }
    .paper.full {
      min-height: 260px;
      font-size: 1.15rem;
    }
    .paper.color {
      background: linear-gradient(160deg, #fff3d6, #ffe0e0);
    }
    .paper p {
      margin: 4px 0;
    }
    .masthead {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border-bottom: 3px double #333;
      text-align: center;
      margin-bottom: 8px !important;
    }
    .cursor {
      color: #999;
    }
    .round {
      margin: 0;
      text-align: center;
    }
    .fragments {
      display: grid;
      gap: 6px;
      width: min(520px, 100%);
    }
    .fragment {
      text-align: left;
      font-weight: 400;
      background: #fff;
      color: var(--ink);
      border-color: var(--ink-soft);
      font-family: Georgia, serif;
    }
    .control {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
    }
    .small {
      padding: 2px 10px;
    }
    .buy {
      display: grid;
      gap: 6px;
      justify-items: center;
      border-top: 1px solid var(--line);
      padding-top: 10px;
      width: 100%;
    }
    .buy p {
      margin: 0;
    }
    @media (max-width: 800px) {
      .ads {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AdvertisingScreenComponent {
  private readonly game = inject(GameService);
  private readonly art = inject(ArtCacheService);
  private readonly shell = inject(ShellService);

  protected readonly channels = AD_CHANNELS;
  protected readonly formats = NEWSPAPER_FORMATS;
  protected readonly rounds = SLOGAN_ROUNDS;
  protected readonly posterW = POSTER_W;
  protected readonly posterH = POSTER_H;
  protected readonly posterCount = POSTERS.length;
  protected readonly step = FLYER_STEP;
  protected readonly minFlyers = MIN_FLYERS;
  protected readonly maxFlyers = MAX_FLYERS;
  protected readonly minDays = MIN_CAMPAIGN_DAYS;
  protected readonly maxDays = MAX_CAMPAIGN_DAYS;

  protected readonly channel = signal<AdChannel>('flyers');
  protected readonly days = signal(MIN_CAMPAIGN_DAYS);
  protected readonly flyers = signal(MIN_FLYERS);
  protected readonly posterIndex = signal(0);
  protected readonly tvIndex = signal(0);
  protected readonly message = signal('');
  /** The slogan game mutates in place; this counter makes its changes visible to signals. */
  private readonly sloganVersion = signal(0);
  private slogan_ = new SloganGame();
  protected readonly game_ = computed(
    () => {
      this.sloganVersion();
      return this.slogan_;
    },
    { equal: () => false },
  );

  private readonly cityId = computed(() => this.game.state()?.currentCityId ?? 'rome');
  protected readonly cityName = computed(() => cityDef(this.cityId()).name);
  protected readonly company = computed(() => this.game.human()?.name ?? 'Your pizzeria');
  /** Population-weighted average district wealth: rich cities respond to different ads than thrifty ones. */
  private readonly wealth = computed(() => {
    const ds = this.game.city()?.districts ?? [];
    const pop = ds.reduce((n, d) => n + d.population, 0) || 1;
    return ds.reduce((n, d) => n + d.wealth * d.population, 0) / pop;
  });
  private readonly col = computed(() => cityDef(this.cityId()).costOfLiving);

  protected readonly running = (c: AdChannel) =>
    this.game.human()?.ads.find((a) => a.cityId === this.cityId() && a.channel === c) ?? null;
  protected readonly current = computed(() => {
    this.game.state();
    return this.running(this.channel());
  });
  protected readonly channelLabel = computed(
    () => AD_CHANNELS.find((c) => c.id === this.channel())?.label ?? '',
  );
  protected readonly boost = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    return st && me ? Math.round(adEffectiveness(st, me.id, this.cityId()) / 2) : 0;
  });

  protected readonly poster = computed(
    () => POSTERS[this.current()?.posterId ?? this.posterIndex()],
  );
  protected readonly commercial = computed(
    () => TV_COMMERCIALS[this.current()?.tvId ?? this.tvIndex()],
  );
  protected readonly posterImage = computed(() => {
    const p = this.poster();
    const company = this.company();
    return this.art.get(`poster-${p.id}-${company}`, POSTER_W, POSTER_H, (PIXI) =>
      buildPoster(PIXI, p, company),
    );
  });
  protected readonly slogan = computed(() => this.game_().slogan(this.company()));

  /** The campaign the player would buy with the current choices. */
  protected readonly offer = computed(() => {
    const w = this.wealth();
    const days = this.days();
    const col = this.col();
    switch (this.channel()) {
      case 'flyers': {
        const r = flyerRate(this.flyers());
        return { effectiveness: r.effectiveness, cost: campaignCost(r.weeklyCost, days, col) };
      }
      case 'posters': {
        const p = POSTERS[this.posterIndex()];
        return {
          effectiveness: Math.round(p.effectiveness * audienceFit(p.audience, w)),
          cost: campaignCost(p.weeklyCost, days, col),
        };
      }
      case 'newspaper': {
        const g = this.game_();
        return {
          effectiveness: g.finished ? g.effectiveness(w) : 0,
          cost: campaignCost(NEWSPAPER_FORMATS[g.format].weeklyCost, days, col),
        };
      }
      case 'tv': {
        const ad = TV_COMMERCIALS[this.tvIndex()];
        return {
          effectiveness: Math.round(ad.effectiveness * audienceFit(ad.audience, w)),
          cost: campaignCost(ad.weeklyCost, days, col),
        };
      }
    }
  });
  protected readonly canBuy = computed(() => {
    if (this.current()) return false;
    if (this.channel() === 'newspaper' && !this.game_().finished) return false;
    return (this.game.human()?.cash ?? 0) >= this.offer().cost;
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const camp = this.current();
    const offer = this.offer();
    return [
      { label: 'Advertising' },
      { label: this.cityName() },
      { label: 'Channel', value: this.channelLabel() },
      { label: 'Days', value: String(camp ? camp.daysLeft : this.days()) },
      { label: 'Effect', value: `${camp ? camp.effectiveness : offer.effectiveness}%` },
      { label: 'Cost', value: formatMoney(camp ? camp.cost : offer.cost) },
      { label: 'City total', value: `+${this.boost()}` },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const ch = this.channel();
    const busy = !!this.current();
    return [
      {
        id: 'flyers',
        label: 'Flyers',
        icon: ICONS.news,
        pressed: ch === 'flyers',
        action: () => this.selectChannel('flyers'),
      },
      {
        id: 'posters',
        label: 'Posters',
        icon: ICONS.box,
        pressed: ch === 'posters',
        action: () => this.selectChannel('posters'),
      },
      {
        id: 'newspaper',
        label: 'Newspaper',
        icon: ICONS.pencil,
        pressed: ch === 'newspaper',
        action: () => this.selectChannel('newspaper'),
      },
      {
        id: 'tv',
        label: 'TV',
        icon: ICONS.zoom,
        pressed: ch === 'tv',
        action: () => this.selectChannel('tv'),
      },
      {
        id: 'shorter',
        label: 'Shorter',
        icon: ICONS.down,
        disabled: busy || this.days() <= MIN_CAMPAIGN_DAYS,
        action: () => this.changeDays(-7),
      },
      {
        id: 'longer',
        label: 'Longer',
        icon: ICONS.up,
        disabled: busy || this.days() >= MAX_CAMPAIGN_DAYS,
        action: () => this.changeDays(7),
      },
      {
        id: 'prev',
        label: 'Previous',
        icon: ICONS.left,
        disabled: busy || ch === 'newspaper',
        action: () => this.cycle(-1),
      },
      {
        id: 'next',
        label: 'Next',
        icon: ICONS.right,
        disabled: busy || ch === 'newspaper',
        action: () => this.cycle(1),
      },
      {
        id: 'buy',
        label: 'Buy',
        icon: ICONS.save,
        disabled: !this.canBuy(),
        action: () => this.buy(),
      },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(
      this.shell.register(this, { lines: this.lines, tools: this.tools }),
    );
  }

  protected selectChannel(c: AdChannel): void {
    this.channel.set(c);
    this.message.set('');
  }

  protected clampFlyers(n: number): number {
    return Math.max(MIN_FLYERS, Math.min(MAX_FLYERS, n));
  }

  protected changeDays(delta: number): void {
    this.days.update((d) => Math.max(MIN_CAMPAIGN_DAYS, Math.min(MAX_CAMPAIGN_DAYS, d + delta)));
  }

  protected cyclePoster(delta: number): void {
    this.posterIndex.update((i) => (i + delta + POSTERS.length) % POSTERS.length);
  }

  protected cycleTv(delta: number): void {
    this.tvIndex.update((i) => (i + delta + TV_COMMERCIALS.length) % TV_COMMERCIALS.length);
  }

  private cycle(delta: number): void {
    if (this.channel() === 'posters') this.cyclePoster(delta);
    else if (this.channel() === 'tv') this.cycleTv(delta);
    else if (this.channel() === 'flyers')
      this.flyers.set(this.clampFlyers(this.flyers() + delta * FLYER_STEP));
  }

  protected pickFragment(family: number): void {
    this.slogan_.pick(family);
    this.sloganVersion.update((v) => v + 1);
  }

  protected changeFormat(delta: number): void {
    this.slogan_.format = Math.max(
      0,
      Math.min(NEWSPAPER_FORMATS.length - 1, this.slogan_.format + delta),
    );
    this.sloganVersion.update((v) => v + 1);
  }

  protected restartSlogan(): void {
    this.slogan_ = new SloganGame();
    this.sloganVersion.update((v) => v + 1);
  }

  protected fitLabel(audience: string): string {
    return audience === 'rich'
      ? 'suits wealthy cities'
      : audience === 'thrifty'
        ? 'suits thrifty cities'
        : 'appeals to everyone';
  }

  protected buy(): void {
    if (!this.canBuy()) return;
    const offer = this.offer();
    const base: AdCampaign = {
      cityId: this.cityId(),
      channel: this.channel(),
      daysLeft: this.days(),
      effectiveness: offer.effectiveness,
      cost: offer.cost,
    };
    const ch = this.channel();
    const campaign: AdCampaign =
      ch === 'flyers'
        ? { ...base, flyers: this.flyers() }
        : ch === 'posters'
          ? { ...base, posterId: this.posterIndex() }
          : ch === 'tv'
            ? { ...base, tvId: this.tvIndex() }
            : { ...base, slogan: this.slogan(), format: this.slogan_.format };
    if (this.game.advertise(campaign)) {
      this.message.set('Campaign booked.');
      if (ch === 'newspaper') this.restartSlogan();
    } else {
      this.message.set('Could not book the campaign.');
    }
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
