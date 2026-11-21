// @vitest-environment jsdom
// The Expertise step (G-208, ex-3 to ex-7; mockup december/29 X1–X5, X7): the words, the limits that say why, Next and
// Decide later, the after-approval form and the review's line. Every class, skill and number is invented (hard rule
// 2): the Fen Prowler, its skills, and the Reed Singer whose skills are a target rolled or higher.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '../ui/ToastHost.tsx';
import { ExpertiseStep, doneWords, expertiseHeading, expertiseHint, expertiseReviewLine, expertiseSetup, pointsLine, type ExpertiseSetup } from './ExpertiseStep.tsx';
import type { Expertise } from '../modules/characters/expertise.ts';
import type { Skill } from '../modules/characters/play.ts';
import { SkillSheet } from './FigureSheets.tsx';

afterEach(() => cleanup());

const prowler = {
  id: 'fen-prowler',
  name: 'Fen Prowler',
  skills: {
    die: 'd6',
    names: { SW: 'Scale walls', SS: 'Spot snares', WL: 'Work locks', RC: 'Read the drowned cyphers of the Weir-kings' },
    notes: { WL: 'Open a lock with picks and patience.' },
    points: { atStart: 3, perLevel: 1, base: 1, best: 4, name: 'Expertise' },
  },
};
const singer = {
  id: 'reed-singer',
  name: 'Reed Singer',
  skills: { die: 'd6', rollMode: 'equal-or-over', names: { CC: 'Charm a crowd', KS: 'Know the old songs' }, points: { atStart: 3, perLevel: 1, base: 6, best: 3, name: 'Expertise' } },
};
const setupOf = (klass: Record<string, unknown>) => expertiseSetup(klass)!;

function step({ setup = setupOf(prowler), level = 1, saved = {}, chosen = {}, who = { gm: false, approved: false }, onSave = vi.fn(async () => true), onLater }: { setup?: ExpertiseSetup; level?: number; saved?: Expertise; chosen?: Expertise; who?: { gm: boolean; approved: boolean }; onSave?: (p: Expertise) => Promise<boolean>; onLater?: () => void } = {}) {
  render(
    <ToastHost>
      <ExpertiseStep setup={setup} level={level} saved={saved} chosen={chosen} who={who} title="Expertise" why="Each point makes one skill better." help={null} onSave={onSave} {...(onLater ? { onLater } : {})} onBack={() => {}} />
    </ToastHost>,
  );
  return { onSave };
}
const card = (name: string) => screen.getByRole('button', { name }).closest('li') as HTMLElement;
const more = (name: string) => screen.getByRole('button', { name: `More points on ${name}` });
const less = (name: string) => screen.getByRole('button', { name: `Less points on ${name}` });

describe('the step’s words', () => {
  // Purpose: the step reads as drawn: "Spend 3 points" and its count, the muted line in the pack's style, and each
  // skill's points and figure.
  it('shows the heading, the count, where every skill starts and its best, and each skill’s figure', () => {
    step({ chosen: { SS: 1 } });
    expect(screen.getByRole('heading', { name: /Spend 3 points/ }).textContent).toMatch(/1 of 3 spent/);
    expect(screen.getByText('Every skill starts at 1-in-6; at best 4-in-6.')).toBeTruthy();
    expect(within(card('Spot snares')).getByText('1 point')).toBeTruthy();
    expect(within(card('Spot snares')).getByText('2-in-6')).toBeTruthy();
    expect(within(card('Scale walls')).getByText('No points')).toBeTruthy();
    // A card with points is on the wash (its words say it too, never colour alone).
    expect(card('Spot snares').className).toMatch(/expertise-row--points/);
    expect(card('Scale walls').className).not.toMatch(/expertise-row--points/);
  });

  // Purpose: a skill rolled the target or higher moves down with each point (X3), written as the sheet writes it.
  it('writes a target-rolled-or-higher skill as "5+" and moves it down', async () => {
    const user = userEvent.setup();
    step({ setup: setupOf(singer) });
    expect(screen.getByText('Every skill starts at 6+; at best 3+.')).toBeTruthy();
    await user.click(more('Charm a crowd'));
    expect(within(card('Charm a crowd')).getByText('5+')).toBeTruthy();
  });

  // Purpose: the foot's line says what is left, and nothing once all is spent (X1); the points line names new ones (X5).
  it('words the foot, the points line and the heading after a level', () => {
    expect(expertiseHint(1)).toBe('1 point to spend');
    expect(expertiseHint(0)).toBe('');
    expect(pointsLine(0, 0)).toBe('No points');
    expect(pointsLine(2, 1)).toBe('2 points, 1 new');
    expect(pointsLine(1, 1)).toBe('1 point');
    expect(expertiseHeading(4, 1, 2, true)).toBe('1 new point, for level 2');
    expect(expertiseHeading(3, 3, 1, false)).toBe('Spend 3 points');
  });
});

describe('every limit says why and changes nothing', () => {
  // Purpose: + on a skill at its best explains and leaves the figure (X2 middle).
  it('+ past the best says so', async () => {
    const user = userEvent.setup();
    step({ chosen: { WL: 3 } });
    await user.click(more('Work locks'));
    expect(await screen.findByText('Work locks is at its best: 4-in-6.')).toBeTruthy();
    expect(within(card('Work locks')).getByText('4-in-6')).toBeTruthy();
  });

  // Purpose: + with every point spent explains and leaves the skill (X2 right).
  it('+ with every point spent says to take one back first', async () => {
    const user = userEvent.setup();
    step({ chosen: { SS: 1, WL: 2 } });
    await user.click(more('Scale walls'));
    expect(await screen.findByText('All 3 points spent: take one back first.')).toBeTruthy();
    expect(within(card('Scale walls')).getByText('1-in-6')).toBeTruthy();
  });

  // Purpose: Next with points unspent stays tappable, says what is missing and saves nothing (X2 left).
  it('Next with points unspent says "Spend 3 points, or Decide later."', async () => {
    const user = userEvent.setup();
    const { onSave } = step({ onLater: () => {} });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Spend 3 points, or Decide later.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  // Purpose: with every point spent Next saves the points once, as they stand.
  it('Next with every point spent saves them', async () => {
    const user = userEvent.setup();
    const { onSave } = step();
    await user.click(more('Work locks'));
    await user.click(more('Work locks'));
    await user.click(more('Spot snares'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith({ WL: 2, SS: 1 });
  });

  // Purpose: Decide later is there when the step may be put off, and does what the host says.
  it('Decide later calls the host', async () => {
    const user = userEvent.setup();
    const later = vi.fn();
    step({ onLater: later });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    expect(later).toHaveBeenCalled();
  });
});

describe('after approval (ex-2, ex-5; X5)', () => {
  // Purpose: the owner adds the new point; − on a point spent before says why and changes nothing; the card says
  // which points are new.
  it('names the new points, and − on a point spent before says to ask the GM', async () => {
    const user = userEvent.setup();
    step({ level: 2, saved: { WL: 1, SS: 1, SW: 1 }, chosen: { WL: 1, SS: 1, SW: 1 }, who: { gm: false, approved: true } });
    expect(screen.getByRole('heading', { name: /1 new point, for level 2/ }).textContent).toMatch(/0 of 1 spent/);
    await user.click(more('Work locks'));
    expect(within(card('Work locks')).getByText('2 points, 1 new')).toBeTruthy();
    await user.click(less('Spot snares'));
    expect(await screen.findByText('Spent before: ask your GM to move it.')).toBeTruthy();
    expect(within(card('Spot snares')).getByText('1 point')).toBeTruthy();
    // The point added in this visit can be taken back.
    await user.click(less('Work locks'));
    expect(within(card('Work locks')).getByText('1 point')).toBeTruthy();
  });

  // Purpose: the GM's Move points takes back any point (ex-6).
  it('the GM takes back a point spent before', async () => {
    const user = userEvent.setup();
    step({ level: 2, saved: { WL: 2 }, chosen: { WL: 2 }, who: { gm: true, approved: true } });
    await user.click(less('Work locks'));
    expect(within(card('Work locks')).getByText('1 point')).toBeTruthy();
  });

  // Purpose: the GM's Move points saves a moved point while the character still has a point unspent (ex-6: − and +
  // free), instead of asking the GM to spend the player's point first.
  it('the GM moves a point on a character with one unspent, and it saves', async () => {
    const user = userEvent.setup();
    const { onSave } = step({ level: 2, saved: { WL: 2, SS: 1 }, chosen: { WL: 2, SS: 1 }, who: { gm: true, approved: true } });
    await user.click(less('Work locks'));
    await user.click(more('Scale walls'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith({ WL: 1, SS: 1, SW: 1 });
    expect(screen.queryByText(/^Spend 1 point/)).toBeNull();
  });

  // Purpose: after approval, the owner who spent some of the new points saves them and the rest wait; one who spent
  // none is told what's missing and nothing is saved.
  it('the owner saves part of the new points, but not a visit that spent none', async () => {
    const user = userEvent.setup();
    const { onSave } = step({ level: 3, saved: { WL: 1, SS: 1, SW: 1 }, chosen: { WL: 1, SS: 1, SW: 1 }, who: { gm: false, approved: true } });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Spend 2 points.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(more('Work locks'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith({ WL: 2, SS: 1, SW: 1 });
  });

  // Purpose: approved at level 1 with points put off, the heading names the points still to spend, as the count does
  // ("Spend 2 points", "0 of 2 spent"), not the class's 3.
  it('after approval at level 1, the heading and the count agree', () => {
    expect(expertiseHeading(3, 2, 1, true)).toBe('Spend 2 points');
    step({ level: 1, saved: { SS: 1 }, chosen: { SS: 1 }, who: { gm: false, approved: true } });
    expect(screen.getByRole('heading', { name: /Spend 2 points/ }).textContent).toMatch(/0 of 2 spent/);
  });
});

describe('the skill’s pop-up (ex-6, X6)', () => {
  const skill: Skill = { code: 'WL', name: 'Work locks', shown: '3-in-6', odds: 'Succeeds on 4, 5 or 6, 3 in 6', chance: null, gmRolls: false, group: 'class', text: 'Open a lock with picks and patience.' };
  const line = { label: 'Expertise', words: '2 points. Every skill starts at 1-in-6; at best 4-in-6' };

  // Purpose: the GM's view adds a plain Move points beside Got it, and it opens the step; without it, there is none.
  it('Move points shows only where the host gives it (the GM), beside Got it', async () => {
    const user = userEvent.setup();
    const move = vi.fn();
    render(<SkillSheet skill={skill} roll={null} source="Fen sample" expertise={line} onMovePoints={move} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Work locks' });
    const foot = dialog.querySelector('.dialog__got-it') as HTMLElement;
    expect([...foot.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Move points', 'Got it']);
    expect(foot.querySelector('.button-primary')).toBeNull();
    await user.click(within(foot).getByRole('button', { name: 'Move points' }));
    expect(move).toHaveBeenCalled();
    cleanup();
    render(<SkillSheet skill={skill} roll={null} source="Fen sample" expertise={line} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Move points' })).toBeNull();
  });

  // Purpose: the Expertise line comes after the pack's words and before the source (X6).
  it('puts the Expertise line after the pack’s words, before the source', () => {
    render(<SkillSheet skill={skill} roll={null} source="Fen sample" expertise={line} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Work locks' });
    const text = dialog.textContent ?? '';
    expect(text.indexOf('Open a lock')).toBeLessThan(text.indexOf('Expertise 2 points'));
    expect(text.indexOf('Expertise 2 points')).toBeLessThan(text.indexOf('From your setting'));
  });
});

describe('the review’s card and the Done toast', () => {
  // Purpose: Review's card lists the skills with points and their figures, then the rest (X7 left), and what waits
  // after Decide later (X7 right).
  it('lists the skills with points, then the rest; or what was decided later', () => {
    const setup = setupOf(prowler);
    expect(expertiseReviewLine(setup, { SS: 1, WL: 2 }, 1, false)).toBe('Spot snares 2-in-6, Work locks 3-in-6. The rest 1-in-6.');
    expect(expertiseReviewLine(setup, {}, 1, true)).toBe('Decided later: 3 points to spend, on the To finish list');
  });

  // Purpose: Done's toast names each skill the visit changed, with its new figure (ex-5).
  it('names what changed', () => {
    expect(doneWords(setupOf(prowler), { WL: 1 }, { WL: 2 })).toBe('Expertise: Work locks 3-in-6.');
  });
});
