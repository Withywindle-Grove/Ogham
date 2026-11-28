// The Player screen's left column with the menu open on an iPad in landscape (the third creation test, ct3-7): the
// column (vitals, at hand, saves) shrinks to make room for the open menu, and nothing in it is cut off or runs
// under the full sheet beside it.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

const LANDSCAPE = [
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'ipad-air-landscape', width: 1180, height: 820 },
  { name: 'ipad-pro-landscape', width: 1366, height: 1024 },
] as const;

const campaignRow = (page: Page) => page.getByRole('button', { name: /The Drowned Marches/ });

/** Things inside the play column that reach past its right edge, or under the sheet beside it. */
async function cutOff(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const pane = document.querySelector('.player--wide > .player__pane');
    const aside = document.querySelector('.player--wide > .player__aside');
    if (!pane) return ['no play column'];
    const edge = pane.getBoundingClientRect().right;
    const problems: string[] = [];
    if (aside && edge > aside.getBoundingClientRect().left + 1) problems.push(`the column runs under the sheet by ${Math.round(edge - aside.getBoundingClientRect().left)}px`);
    for (const el of Array.from(pane.querySelectorAll<HTMLElement>('*'))) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Text kept for screen readers only (the Player screen's name, in the bar since the standard) clips on purpose.
      if (el.classList.contains('visually-hidden')) continue;
      if (box.right > edge + 1) problems.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'} "${(el.textContent ?? '').trim().slice(0, 30)}" ends ${Math.round(box.right - edge)}px past the column`);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') problems.push(`${el.tagName.toLowerCase()}.${el.className} clips ${el.scrollWidth - el.clientWidth}px`);
    }
    return problems.slice(0, 10);
  });
}

for (const size of LANDSCAPE) for (const text of ['standard', 'larger'] as const) {
  test(`the play column fits beside the open menu (${size.name}, ${size.width}×${size.height}, ${text} text)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    // The menu open (the divider handle's state is kept on the device; folded is the default since mn-1), at the
    // device's text size.
    await page.addInitScript((larger) => {
      localStorage.setItem('grimoire.navCollapsed', 'no');
      if (larger) localStorage.setItem('grimoire.textSize', 'larger');
    }, text === 'larger');
    await page.goto('/layout.html?as=player');
    await campaignRow(page).click();
    await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens' }).first()).toBeVisible();
    await expect(page.locator('.player--wide > .player__pane')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeVisible();
    // The stand-in character has no class figures, so the column gets a fighter's as the screen draws them (the
    // real parts' classes): AC and attack tiles with their captions, six saves with a magic resistance, three skills.
    await page.evaluate(() => {
      const pane = document.querySelector('.player--wide > .player__pane .vitals') ?? document.querySelector('.player--wide > .player__pane');
      const probe = document.createElement('div');
      probe.setAttribute('data-probe', 'figures');
      const tile = (label: string, value: string, caption: string) =>
        `<button type="button" class="stat-tile stat-tile--tap"><span class="stat-tile__label">${label}</span><span class="stat-tile__value">${value}</span><span class="stat-tile__caption">${caption}</span></button>`;
      const save = (s: string, v: string) => `<button type="button" class="save-row__save"><span class="save-row__name">${s}</span><span class="save-row__value">${v}</span></button>`;
      const skill = (s: string, v: string) => `<button type="button" class="skill-grid__skill"><span class="skill-grid__name">${s}</span><span class="skill-grid__value">${v}</span></button>`;
      probe.innerHTML =
        `<div class="stat-row">${tile('ac', '14', 'quilted coat, shield, DEX +1')}${tile('attack', '+1', 'melee +1, missile +0')}${tile('level', '1', 'Lantern Warden')}${tile('xp', '999', 'of 2000')}</div>` +
        `<div class="save-row">${['Doom', 'Ray', 'Hold', 'Blast', 'Spell', 'Magic resistance'].map((s, n) => save(s, String(10 + n))).join('')}</div>` +
        `<div class="skill-grid">${[skill('Listen', '5'), skill('Search', '6'), skill('Survival when foraging', '5')].join('')}</div>`;
      pane?.appendChild(probe);
    });
    await page.screenshot({ path: `test-results/layout-screens/player-column-${size.name}-${text}.png`, fullPage: true });
    expect(await cutOff(page)).toEqual([]);
    // And with the menu folded the column has room too.
    await page.getByRole('button', { name: 'Fold the menu' }).click();
    expect(await cutOff(page)).toEqual([]);
  });
}
