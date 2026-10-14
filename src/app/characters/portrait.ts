import { Component, computed, inject, input } from '@angular/core';
import { Look } from '../game/characters';
import { PortraitService } from './portrait.service';

/** A character portrait rendered by PixiJS, shown as an image with alt text. */
@Component({
  selector: 'app-portrait',
  template: `
    @if (src(); as s) {
      <img [src]="s" [alt]="alt()" [width]="size()" [height]="size()" />
    } @else {
      <span class="placeholder" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="alt()"></span>
    }
  `,
  styles: `
    :host { display: inline-block; line-height: 0; }
    img, .placeholder { border-radius: 8px; display: block; }
    .placeholder { background: #0002; }
  `,
})
export class PortraitComponent {
  private readonly portraits = inject(PortraitService);
  readonly cacheKey = input.required<string>();
  readonly look = input.required<Look>();
  readonly background = input(0x457b9d);
  readonly alt = input('');
  readonly size = input(96);
  protected readonly src = computed(() => this.portraits.get(this.cacheKey(), this.look(), this.background()));
}
