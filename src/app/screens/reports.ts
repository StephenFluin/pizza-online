import { UiService } from '../game/ui.service';
import { ICONS, Tool } from '../shell/shell.service';

export type ReportKind = 'finances' | 'stats' | 'research' | 'news';

/** Reports share one tool button on the city screen and a row of tabs, so each is a click away from the others. */
export const REPORTS: { kind: ReportKind; label: string; short: string; icon: string }[] = [
  { kind: 'finances', label: 'Finances', short: 'Finances', icon: ICONS.chart },
  { kind: 'stats', label: 'Statistics', short: 'Statistics', icon: ICONS.up },
  { kind: 'research', label: 'Market research', short: 'Research', icon: ICONS.zoom },
  { kind: 'news', label: 'Newspaper', short: 'News', icon: ICONS.news },
];

/** Tool-grid buttons for switching between the reports. */
export function reportTools(ui: UiService, current: string | undefined): Tool[] {
  return REPORTS.map((r) => ({
    id: r.kind,
    label: r.short,
    icon: r.icon,
    pressed: r.kind === current,
    action: () => ui.open({ kind: r.kind }),
  }));
}
