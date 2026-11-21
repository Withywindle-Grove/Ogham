// @vitest-environment jsdom
// Rules for this campaign's organism (06 Components; ruled 2026-11-02, lr-7). What these check, in plain words:
//   * each topic group is folded with a count line ("2 settings · 1 changed"), and a group with a body keeps its own words;
//   * an optional-rules group per source (RuleSourceGroup) sits in the same list and says "none" when its pack has no rules;
//   * on a phone (`single`) opening a group folds the one that was open; on a tablet both stay open;
//   * a group's `lead` (the clash callout) shows above its header even while the group is folded;
//   * a group tapped open scrolls its heading to the top (phone test, 2026-11-09); folding one scrolls nothing.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RulesForThisCampaign, settingsLine, type RuleGroup } from './organisms.tsx';

afterEach(cleanup);

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const GROUPS: RuleGroup[] = [
  {
    id: 'characters',
    name: 'Characters',
    rules: [
      { id: 'approval', name: 'New characters need approval', source: 'The app', choices: YES_NO, value: 'no', defaultValue: 'yes' },
    ],
  },
  { id: 'fields', name: 'Character fields', rules: [], summary: '4 fields', body: <p>The field editor</p> },
  {
    id: 'optional:fen',
    name: 'Optional rules: Fen Rules',
    rules: [],
    lead: <p>Two packs offer an encumbrance rule.</p>,
    source: { count: '1 rule, none changed', rows: [{ id: 'oil', changed: false, row: <p key="oil">Lanterns need oil</p> }] },
  },
  { id: 'optional:abbey', name: 'Optional rules: The Drowned Abbey', rules: [], source: { count: 'none', rows: [] } },
];

describe('Rules for this campaign (lr-7)', () => {
  it('folds every group with its count line; a body group keeps its words; a pack without rules says none and opens nothing', () => {
    render(<RulesForThisCampaign groups={GROUPS} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Characters, 1 setting, 1 changed' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Character fields, 4 fields' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Optional rules: Fen Rules, 1 rule, none changed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Optional rules: The Drowned Abbey, none' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /The Drowned Abbey/ })).toBeNull();
    // The clash callout shows above its group while folded.
    expect(screen.getByText('Two packs offer an encumbrance rule.')).toBeTruthy();
    expect(settingsLine(1, 0)).toBe('1 setting, none changed');
  });

  it('on a tablet any number of groups stay open', async () => {
    const person = userEvent.setup();
    render(<RulesForThisCampaign groups={GROUPS} onChange={() => undefined} />);
    await person.click(screen.getByRole('button', { name: /^Characters/ }));
    await person.click(screen.getByRole('button', { name: /^Optional rules: Fen Rules/ }));
    expect(screen.getByRole('button', { name: /^Characters/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /^Optional rules: Fen Rules/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('New characters need approval')).toBeTruthy();
  });

  it('on a phone opening a group folds the one that was open', async () => {
    const person = userEvent.setup();
    render(<RulesForThisCampaign groups={GROUPS} onChange={() => undefined} single />);
    await person.click(screen.getByRole('button', { name: /^Characters/ }));
    await person.click(screen.getByRole('button', { name: /^Character fields/ }));
    expect(screen.getByRole('button', { name: /^Characters/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /^Character fields/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('The field editor')).toBeTruthy();
    // Folding the open one leaves none open.
    await person.click(screen.getByRole('button', { name: /^Character fields/ }));
    expect(screen.queryByText('The field editor')).toBeNull();
  });

  // Purpose: tapping a group open brings its heading to the top of the screen (so its first item shows, not its
  // middle), even on a phone where the group above folds at the same moment; folding a group doesn't move the page.
  it('a group tapped open scrolls its heading to the top; folding scrolls nothing', async () => {
    const person = userEvent.setup();
    const scrolled: { id: string; options: unknown }[] = [];
    // jsdom has no scrollIntoView: stand one in that notes which group asked, and how.
    const before = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement, options?: boolean | ScrollIntoViewOptions) {
      scrolled.push({ id: this.id, options });
    });
    try {
      render(<RulesForThisCampaign groups={GROUPS} onChange={() => undefined} single />);
      await person.click(screen.getByRole('button', { name: /^Characters/ }));
      await person.click(screen.getByRole('button', { name: /^Optional rules: Fen Rules/ }));
      expect(scrolled).toEqual([
        { id: 'rules-group-characters', options: { block: 'start' } },
        { id: 'rules-group-optional:fen', options: { block: 'start' } },
      ]);
      await person.click(screen.getByRole('button', { name: /^Optional rules: Fen Rules/ }));
      expect(scrolled).toHaveLength(2);
    } finally {
      HTMLElement.prototype.scrollIntoView = before;
    }
  });
});
