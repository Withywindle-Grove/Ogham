import { expect } from '@playwright/test';
import { test } from '../fails.ts';
import { layoutProblems } from './checks.ts';

// The Expertise step (G-208; mockup december/29 X1, approved 2026-11-20 with the foot on one line) and every creation
// step's foot (ex-4, ex-9), measured in the gallery's "Creation: the shell" section in WebKit at a phone (375), an
// iPad upright (820) and a tablet on its side (1024). Purposes, the same at every width:
//   * the Expertise step's foot: "1 point to spend" on its own line, then Decide later at the left and Back and Next
//     at the right, all three on one line through their middles, Next at the foot's right edge;
//   * another step's foot (the shell's Class step, Back and Next): its line above the buttons, Back and Next on one line;
//   * each skill card keeps its stepper inside the card (a long name wraps under its own words), − and + 44 px tall;
//   * nothing scrolls sideways, no target under 44 px, no text under 14 px.

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'iPad', width: 820, height: 1180 },
  { name: 'tablet', width: 1024, height: 768 },
]) {
  test(`the Expertise step and the shell's foot: the line, then Decide later, Back and Next on one line (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const box = (el: Element): Box => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const section = document.getElementById('creation-shell') as HTMLElement;
      const steps = [...section.querySelectorAll('.creation-step')];
      const expertise = steps.find((s) => s.querySelector('.expertise__list')) as HTMLElement;
      const classStep = steps[0] as HTMLElement;
      const footOf = (step: HTMLElement) => {
        const foot = step.querySelector('.creation-step__foot') as HTMLElement;
        const button = (text: string) => [...foot.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === text);
        const at = (text: string) => {
          const b = button(text);
          return b ? box(b) : null;
        };
        return { foot: box(foot), hint: box(foot.querySelector('.creation-step__hint')!), hintText: (foot.querySelector('.creation-step__hint')!.textContent ?? '').trim(), later: at('Decide later'), back: at('Back'), next: at('Next') };
      };
      const cards = [...expertise.querySelectorAll('.expertise-row')].map((card) => ({
        card: box(card),
        steps: [...card.querySelectorAll('.stepper__step')].map(box),
        name: (card.querySelector('.expertise-row__name')!.textContent ?? '').trim(),
      }));
      return { expertise: footOf(expertise), classStep: footOf(classStep), cards };
    });
    const at = `${size.name}, ${size.width} px`;
    const middle = (b: Box) => (b.top + b.bottom) / 2;

    // The Expertise step's foot (X1): the line, then the three on one line.
    const e = m.expertise;
    expect(e.hintText, at).toBe('1 point to spend');
    expect(e.later && e.back && e.next, `Decide later, Back and Next (${at})`).toBeTruthy();
    const [later, back, next] = [e.later!, e.back!, e.next!];
    expect(Math.min(later.top, back.top, next.top), `the line above the buttons (${at})`).toBeGreaterThanOrEqual(e.hint.bottom - 0.5);
    expect(Math.abs(middle(later) - middle(back)), `Decide later and Back on one line (${at})`).toBeLessThan(2);
    expect(Math.abs(middle(back) - middle(next)), `Back and Next on one line (${at})`).toBeLessThan(2);
    expect(Math.abs(later.left - e.foot.left), `Decide later at the left (${at})`).toBeLessThanOrEqual(1);
    expect(Math.abs(e.foot.right - next.right), `Next at the right (${at})`).toBeLessThanOrEqual(1);
    expect(next.left - back.right, `Back, then Next (${at})`).toBeGreaterThanOrEqual(8 - 0.5);

    // Another step's foot (ex-9): its line above, Back and Next on one line.
    const c = m.classStep;
    expect(c.back && c.next, `the Class step's Back and Next (${at})`).toBeTruthy();
    expect(Math.min(c.back!.top, c.next!.top), `the Class step's line above its buttons (${at})`).toBeGreaterThanOrEqual(c.hint.bottom - 0.5);
    expect(Math.abs(middle(c.back!) - middle(c.next!)), `the Class step's Back and Next on one line (${at})`).toBeLessThan(2);

    // Each card: the stepper inside it, − and + at least 44 px; the long name wraps rather than squeezing them.
    expect(m.cards.length, at).toBe(4);
    for (const card of m.cards) {
      expect(card.steps.length, `${card.name} (${at})`).toBe(2);
      for (const step of card.steps) {
        expect(step.height, `${card.name}: a 44 px step (${at})`).toBeGreaterThanOrEqual(43.5);
        expect(step.right, `${card.name}: the stepper inside its card (${at})`).toBeLessThanOrEqual(card.card.right + 0.5);
      }
    }
    expect(await layoutProblems(page)).toEqual([]);
  });
}
