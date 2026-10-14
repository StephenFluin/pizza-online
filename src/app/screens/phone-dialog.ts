import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { PortraitComponent } from '../characters/portrait';
import { Contact, ContactKind } from '../game/contacts';
import { PhoneService } from '../game/phone.service';

const GROUPS: { kind: ContactKind; label: string }[] = [
  { kind: 'realtor', label: 'Realtors' },
  { kind: 'bank', label: 'Bank' },
  { kind: 'supplier', label: 'Wholesaler' },
  { kind: 'agency', label: 'Staff agency' },
  { kind: 'insurance', label: 'Insurance' },
  { kind: 'mayor', label: 'City hall' },
];

/** The phone: a phone book on the left and the live call on the right. Picking a contact connects at once. */
@Component({
  selector: 'app-phone-dialog',
  imports: [PortraitComponent],
  template: `
    <div class="phone">
      <nav class="book" aria-label="Phone book">
        @for (g of groups(); track g.kind) {
          <h3>{{ g.label }}</h3>
          <ul>
            @for (c of g.contacts; track c.id) {
              <li>
                <button type="button" class="link" [attr.aria-current]="phone.call()?.contact?.id === c.id" (click)="phone.connect(c)">
                  {{ c.name }}<br /><small>{{ c.company }}</small>
                </button>
              </li>
            }
          </ul>
        }
      </nav>

      <section class="call" aria-label="Call">
        @if (phone.call(); as call) {
          <header class="who">
            <app-portrait [cacheKey]="'contact-' + call.contact.id" [look]="call.contact.look" [background]="call.contact.color" [size]="72" [alt]="call.contact.name" />
            <div>
              <b>{{ call.contact.name }}</b><br />
              {{ call.contact.company }}<br />
              <small>{{ call.ended ? 'Call ended' : 'Connected' }}</small>
            </div>
          </header>
          <ol class="transcript" #transcript aria-live="polite">
            @for (line of call.lines; track $index) {
              <li [class]="line.from">{{ line.text }}</li>
            }
          </ol>
          <div class="options">
            @for (o of call.options; track o.id) {
              <button type="button" class="option" (click)="phone.choose(o.id)">{{ o.label }}</button>
            }
            <button type="button" class="secondary" (click)="phone.hangUp()">{{ call.ended ? 'Put the phone down' : 'Hang up' }}</button>
          </div>
        } @else {
          <p class="idle">Pick someone from the phone book to call them. Tip: select a lot on the map and use “Call realtor” to talk about that property.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .phone { display: grid; grid-template-columns: 220px minmax(320px, 460px); gap: 16px; }
    .book { max-height: 65dvh; overflow: auto; border-right: 1px solid var(--line); padding-right: 8px; }
    .book h3 { margin: 8px 0 4px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .book ul { list-style: none; margin: 0; padding: 0; }
    .book button[aria-current='true'] { background: var(--cream); }
    .call { display: grid; gap: 8px; align-content: start; }
    .who { display: flex; gap: 12px; align-items: center; }
    .transcript { list-style: none; margin: 0; padding: 8px; background: #2b1d14; border-radius: 8px; max-height: 40dvh; min-height: 120px; overflow: auto; display: grid; gap: 6px; align-content: start; }
    .transcript li { padding: 6px 10px; border-radius: 10px; max-width: 85%; }
    .transcript .them { background: var(--cream); color: var(--ink); justify-self: start; }
    .transcript .me { background: #f4d58d; color: #2b1d14; justify-self: end; }
    .options { display: grid; gap: 6px; }
    .option { text-align: left; font-weight: 400; background: var(--panel); color: var(--ink); border-color: var(--ink-soft); }
    .idle { margin: 0; }
    @media (max-width: 700px) { .phone { grid-template-columns: 1fr; } .book { max-height: 30dvh; border-right: none; } }
  `,
})
export class PhoneDialogComponent {
  protected readonly phone = inject(PhoneService);
  private readonly transcript = viewChild<ElementRef<HTMLOListElement>>('transcript');

  protected readonly groups = computed(() => {
    const contacts: Contact[] = this.phone.contacts();
    return GROUPS.map((g) => ({ ...g, contacts: contacts.filter((c) => c.kind === g.kind) }));
  });

  constructor() {
    // Keep the newest line in view.
    effect(() => {
      this.phone.call();
      const el = this.transcript()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }
}
