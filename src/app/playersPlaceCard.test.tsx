// @vitest-environment jsdom
// The players' place card (plan dec-9-the-players-scene, P4; p4s-1 to p4s-4, rp-7, rp-8, p2p-24; page 24 PL1b to PL1d,
// set 9's PR1 to PR5b). Drawn from what the players' reads give; the reads' own rule is the database's
// (supabase/tests/p4-players-place-card.test.ts). Invented words only.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../core/supabase.ts';
import { readPlaceCards, readSharedKnowledge, type PlayersPlaceCard } from '../modules/expedition/placeKnowledge.ts';
import type { PlayersRule } from '../modules/expedition/placeRules.ts';
import { areaCardShows, PlayersAreaCard, PlayersLocationCard } from './PlayersPlaceCard.tsx';

afterEach(cleanup);

const card = (rows: Record<string, unknown>[]): PlayersPlaceCard => readPlaceCards([{ group_number: 1, kind: 'here', at: 0, place_id: 'q1', key: '1', name: 'The Jetty' }, ...rows]).get(1)!;
const harbourCard = card([
  { group_number: 1, kind: 'trail', at: 1, name: 'Saltwick Island' },
  { group_number: 1, kind: 'trail', at: 2, name: 'The Drowned Harbour' },
  { group_number: 1, kind: 'area', at: 0, name: 'The Drowned Harbour' },
  { group_number: 1, kind: 'known', at: 1, place_id: 'q2', key: '2', name: 'The Wreck' },
]);
const knowledge = readSharedKnowledge([{ group_number: 1, share_id: 's1', place_name: 'The Jetty', heading: 'What everyone knows', body: 'The harbour silted in a single winter.\nNobody crosses at slack water.', shared_clock: 0 }]);
const rule = (name: string, placeName = 'The Jetty'): PlayersRule => ({ group: 1, placeName, name, blocks: [{ kind: 'p', lead: '', text: `${name}: the book's words.` }], button: null });

/** A database that answers the known places' read with the Wreck's two shown pieces, seen on two visits. */
const db = {
  rpc: async () => ({
    data: [
      { current: true, place_id: 'q2', place_name: 'The Wreck', kind: 'clue', piece_id: 'w2', body: 'Her ribs stand clear at low water.', lead: 'Ribs' },
      { current: true, place_id: 'q2', place_name: 'The Wreck', kind: 'description', piece_id: 'w1', body: 'A cog on her side on the bar; her ribs green with weed.', lead: '' },
      { current: false, place_id: 'q2', place_name: 'The Wreck', kind: 'description', piece_id: 'w1', body: 'A cog on her side on the bar; her ribs green with weed.', lead: '' },
      { current: true, place_id: 'q9', place_name: 'Elsewhere', kind: 'description', piece_id: 'x1', body: 'Not the Wreck.', lead: '' },
    ],
    error: null,
  }),
} as unknown as Db;

function area(props: Partial<Parameters<typeof PlayersAreaCard>[0]> = {}) {
  render(<PlayersAreaCard db={db} campaignId="c1" card={harbourCard} knowledge={knowledge} rules={[rule('The tide')]} turns={null} {...props} />);
}

describe("the Area's card (the right column)", () => {
  // Purpose: the card is headed with the Area's name once the group was shown it, and lists a row per shared section
  // ("Shared." with no turn known), the Rules row, and the other known Locations with their numbers (PL1b).
  it("shows the Area's name, each shared section, the Rules row and the known Locations", () => {
    area();
    const section = screen.getByRole('region', { name: 'The Drowned Harbour' });
    expect(within(section).getByRole('heading', { name: 'The Drowned Harbour' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'What everyone knows: Shared.' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Rules: The tide' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: /2\. The Wreck/ })).toBeTruthy();
  });

  // Purpose: an Area the group was never shown gives no heading and no stand-in words ("This place" is never drawn).
  it('has no heading when the Area was never shown', () => {
    area({ card: card([{ group_number: 1, kind: 'known', at: 1, place_id: 'q2', key: '2', name: 'The Wreck' }]) });
    expect(screen.queryByRole('heading')).toBeNull();
    expect(document.body.textContent).not.toContain('This place');
  });

  // Purpose: nothing shared, no rule and no other known Location, and no Area shown: no card at all.
  it('draws nothing with nothing to show', () => {
    const bare = card([]);
    expect(areaCardShows(bare, [], [])).toBe(false);
    const { container } = render(<PlayersAreaCard db={db} campaignId="c1" card={bare} knowledge={[]} rules={[]} turns={null} />);
    expect(container.textContent).toBe('');
  });

  // Purpose: a tap on a shared section opens its full words in the standard sheet, titled with its heading.
  it("opens a shared section's full words", async () => {
    const user = userEvent.setup();
    area();
    await user.click(screen.getByRole('button', { name: 'What everyone knows: Shared.' }));
    const sheet = screen.getByRole('dialog', { name: /What everyone knows/ });
    expect(sheet.textContent).toContain('Nobody crosses at slack water.');
  });

  // Purpose (p4s-4): a tap on a known Location opens the standard sheet titled with its numbered name, holding only its
  // shown pieces, each once, the description first with the shown piece's word marked, and nothing of another place.
  it("opens a known Location's shown pieces in the book's format", async () => {
    const user = userEvent.setup();
    area();
    await user.click(screen.getByRole('button', { name: /2\. The Wreck/ }));
    const sheet = await screen.findByRole('dialog', { name: '2. The Wreck' });
    await within(sheet).findByText(/A cog on her side/);
    const paragraphs = [...sheet.querySelectorAll('.players-place__piece')].map((p) => p.textContent);
    expect(paragraphs).toEqual(['A cog on her side on the bar; her ribs green with weed.', 'Ribs. Her ribs stand clear at low water.']);
    expect([...sheet.querySelectorAll('.players-place__named')].map((n) => n.textContent)).toEqual(['ribs']);
    expect(sheet.textContent).not.toContain('Not the Wreck');
  });
});

describe('the Rules row (rp-7)', () => {
  // Purpose: one rule opens at once (no list of one); its words show.
  it('opens a lone rule at once', async () => {
    const user = userEvent.setup();
    area();
    await user.click(screen.getByRole('button', { name: 'Rules: The tide' }));
    expect(screen.getByRole('dialog', { name: 'The tide' }).textContent).toContain("The tide: the book's words.");
  });

  // Purpose: several rules open the list, under each place's name only when two shown places have rules, the place the
  // party is at first; a rule from the list opens over it.
  it('lists several under their places, and opens one', async () => {
    const user = userEvent.setup();
    area({ rules: [rule('Weather on the island', 'Saltwick Island'), rule('The tide'), rule('Rowing and swimming')] });
    await user.click(screen.getByRole('button', { name: 'Rules: 2 here, 1 of Saltwick Island' }));
    const list = screen.getByRole('dialog', { name: /Rules/ });
    expect([...list.querySelectorAll('.players-rules__heading')].map((h) => h.textContent)).toEqual(['The Jetty', 'Saltwick Island']);
    await user.click(within(list).getByRole('button', { name: 'Rowing and swimming' }));
    expect(screen.getByRole('dialog', { name: 'Rowing and swimming' })).toBeTruthy();
  });

  // Purpose (rp-8): a rule the GM closes while its sheet is open loses its words at once and says so.
  it('says a rule is closed when it leaves the read while open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PlayersAreaCard db={db} campaignId="c1" card={harbourCard} knowledge={[]} rules={[rule('The tide')]} turns={null} />);
    await user.click(screen.getByRole('button', { name: 'Rules: The tide' }));
    rerender(<PlayersAreaCard db={db} campaignId="c1" card={harbourCard} knowledge={[]} rules={[]} turns={null} />);
    const sheet = screen.getByRole('dialog', { name: 'The tide' });
    expect(sheet.textContent).toContain('Your GM has closed this rule.');
    expect(sheet.textContent).not.toContain("the book's words");
  });
});

describe("the Location's card (the left column; built, not on the page yet)", () => {
  const pieces = [
    { id: 'p1', kind: 'description', text: 'Past the mooring ring, a skiff rocks under the ladder.', lead: '' },
    { id: 'p2', kind: 'clue', text: 'Fresh rope: someone tied up here this week.', lead: 'Mooring ring' },
  ];
  // Purpose (PL1b): the trail of shown names, "1. The Jetty", then the description with only the shown piece's word
  // marked ("ladder" names a piece still hidden, so it stays plain), then the shown piece led by its own word.
  it("draws the trail, the numbered name and the shown pieces in the book's format", () => {
    render(<PlayersLocationCard card={harbourCard} pieces={pieces} rules={[]} />);
    const cardEl = screen.getByRole('region', { name: 'Where you are: 1. The Jetty' });
    expect(within(cardEl).getByRole('navigation', { name: 'Where this is' }).textContent).toBe('Saltwick IslandThe Drowned Harbour');
    expect(within(cardEl).getByRole('heading', { name: '1. The Jetty' })).toBeTruthy();
    expect([...cardEl.querySelectorAll('.players-place__named')].map((n) => n.textContent)).toEqual(['mooring ring']);
    expect(cardEl.textContent).toContain('Mooring ring. Fresh rope');
  });

  // Purpose (PL1c): with only the description shown, no word in it is marked.
  it('marks nothing when only the description is shown', () => {
    render(<PlayersLocationCard card={harbourCard} pieces={pieces.slice(0, 1)} rules={[]} />);
    expect(document.querySelectorAll('.players-place__named')).toHaveLength(0);
  });
});
