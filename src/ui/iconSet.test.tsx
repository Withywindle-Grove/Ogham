// @vitest-environment jsdom
// The app's icon set (plan dec-9 piece A; ds-6, pf-12c): every icon carries its author and licence, matches its
// source file, draws filled on the set's 512 grid, and every icon name a pack uses still resolves.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICONS as STEP_ICON_NAMES } from '../modules/expedition/modes.ts';
import { STATUS_SYMBOLS } from '../modules/expedition/statusLook.ts';
import { routeWays } from '../modules/library/routes.ts';
import { CC_BY_3, ICON_SET, SET_ICON_NAMES, isSetIconName, wayIconOf } from './iconSet.ts';
import { Icon, packIconOf } from './icons.tsx';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const read = (path: string) => fs.readFileSync(`.${path}`, 'utf8');
const svgFiles = Object.keys(import.meta.glob('/src/ui/iconSet/*.svg'));
const fixtureFiles = Object.keys(import.meta.glob('/scripts/fixtures/*.json'));

/** Every pack icon name in a pack (or part of one), with the field it sits in: a condition's `icon`, else a step's. */
function iconNamesIn(node: unknown, inConditions = false, found: { name: string; field: 'step' | 'condition' }[] = []) {
  if (Array.isArray(node)) for (const child of node) iconNamesIn(child, inConditions, found);
  else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'icon' || key === 'button') && typeof value === 'string') found.push({ name: value, field: key === 'icon' && inConditions ? 'condition' : 'step' });
      else iconNamesIn(value, inConditions || key === 'conditions', found);
    }
  }
  return found;
}

describe('the icon set (ds-6)', () => {
  // Purpose: the seven first icons the plan names are all in the table, then the shop's two coins (cs-21, dec-10 F-b).
  it('holds the first seven icons and the two coins', () => {
    expect(SET_ICON_NAMES.slice(0, 8)).toEqual(['trumpet-flag', 'crystal-ball', 'sword-brandish', 'pointy-hat', 'locked-chest', 'water-splash', 'hourglass', 'two-coins']);
  });

  // Purpose: the Studio's icons for the Scene's top (st-8), the caller's banner, and magic's Cast and Prepare (ic-2)
  // are in the table, each with the author its CREDITS.md gives, and each resolves to the set's own drawing.
  it('holds the Studio’s thirty-two icons, each with its author, each resolving', () => {
    const studio: Record<string, string> = {
      sunrise: 'Delapouite', sun: 'Lorc', sunset: 'Delapouite', 'heraldic-sun': 'Caro Asercion', seagull: 'Delapouite', moon: 'Lorc',
      'fluffy-cloud': 'Lorc', sprout: 'Lorc', sunflower: 'Delapouite', 'maple-leaf': 'Lorc', 'snowflake-1': 'Lorc', 'camping-tent': 'Delapouite',
      'sleeping-bag': 'Delapouite', 'exit-door': 'Delapouite', run: 'Lorc', trail: 'Delapouite', 'night-vision': 'Delapouite',
      'fast-forward-button': 'Delapouite', 'ringing-bell': 'Lorc', 'flag-objective': 'Delapouite', 'power-button': 'Lord Berandas',
      'crossed-swords': 'Lorc', 'play-button': 'Guard13007', cancel: 'Sbed', awareness: 'Lorc', 'night-sleep': 'Delapouite',
      'check-mark': 'Delapouite', confirmed: 'Delapouite', calendar: 'Delapouite', 'knight-banner': 'Delapouite',
      'magic-palm': 'Lorc', 'spell-book': 'Delapouite',
    };
    expect(Object.keys(studio)).toHaveLength(32);
    expect(SET_ICON_NAMES.slice(8, 40)).toEqual(Object.keys(studio));
    for (const [name, author] of Object.entries(studio)) {
      expect(isSetIconName(name), name).toBe(true);
      expect(ICON_SET[name as keyof typeof ICON_SET].author.name, name).toBe(author);
      expect(packIconOf(name, 'step'), name).toEqual({ from: 'set', name });
      const { container, unmount } = render(<Icon name={name as keyof typeof ICON_SET} />);
      expect(container.querySelector('path')!.getAttribute('d'), name).toBe(ICON_SET[name as keyof typeof ICON_SET].d);
      unmount();
    }
  });

  // Purpose: the Player screen's Refill icon (ic-3, ruled 2026-11-14; plan dec-13 C7), the jug, is in the table after
  // the coin icons, by Delapouite as the Studio's CREDITS.md gives, and resolves.
  it('holds the jug for Refill, by Delapouite, resolving', () => {
    expect(SET_ICON_NAMES.slice(42, 43)).toEqual(['jug']);
    expect(ICON_SET.jug.author.name).toBe('Delapouite');
    const { container } = render(<Icon name="jug" />);
    expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.jug.d);
  });

  // Purpose: the Player screen's other ruled button icons (ic-3, page 20 frame IC1; plan dec-13 C6) and Edit's quill are
  // in the table after the jug, each with the author the Studio's CREDITS.md gives, each resolving.
  it('holds the Player screen’s button icons, each with its author, each resolving', () => {
    const ruled: Record<string, string> = {
      'sword-hilt': 'Lorc', fist: 'Lorc', quiver: 'Delapouite', pointing: 'Lorc', 'swap-bag': 'Lorc', torch: 'Delapouite', 'smoking-finger': 'Lorc', 'quill-ink': 'Lorc',
    };
    // Last in the table, after the GM's coin icons (56, 58): the stack's own places stay where they were.
    expect(SET_ICON_NAMES.slice(58, 66)).toEqual(Object.keys(ruled));
    for (const [name, author] of Object.entries(ruled)) {
      expect(isSetIconName(name)).toBe(true);
      if (!isSetIconName(name)) continue;
      expect(ICON_SET[name].author.name).toBe(author);
      const { container } = render(<Icon name={name} />);
      expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[name].d);
    }
  });

  // Purpose: the Pack's coin icons (K10, the lead 2026-11-14), Give's open palm and Put in's open chest, are in the
  // table after the Studio's thirty-two, each by Skoll as the Studio's CREDITS.md gives, each resolving.
  it('holds the Pack’s two coin icons, each by Skoll, each resolving', () => {
    expect(SET_ICON_NAMES.slice(40, 42)).toEqual(['open-palm', 'open-chest']);
    for (const name of ['open-palm', 'open-chest'] as const) {
      expect(ICON_SET[name].author.name).toBe('Skoll');
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[name].d);
      unmount();
    }
  });

  // Purpose (ic-4, TW13; S17 built ahead): the picture piece's Change takes the easel, by Caro Asercion as the Studio's
  // CREDITS.md gives, after the journey, resolving to its own path (S19's two follow it).
  it('holds the picture piece’s easel, by Caro Asercion, resolving', () => {
    expect(SET_ICON_NAMES.slice(46, 47)).toEqual(['easel']);
    expect(ICON_SET.easel.author.name).toBe('Caro Asercion');
    expect(ICON_SET.easel.plain).toBe('Easel');
    const { container, unmount } = render(<Icon name="easel" />);
    expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.easel.d);
    unmount();
  });

  // Purpose (S17): the Scene's last icons follow the easel, each by the author the Studio's CREDITS.md gives, each
  // resolving: ic-4's campfire (Start, Resume), parting arrows (Split party) and unrolled scroll (Saved orders), then
  // ic-6's four answers of Waiting for you (Hit, Miss, Check again, Recharge; page 21, SI2).
  it('holds the Scene’s last seven icons, each with its author, each resolving', () => {
    const s17: Record<string, string> = {
      campfire: 'Lorc', 'split-arrows': 'Delapouite', 'scroll-unfurled': 'Lorc',
      bullseye: 'Skoll', 'shield-bounces': 'Lorc', 'rolling-dice-cup': 'Delapouite', 'crystal-wand': 'Lorc',
    };
    expect(SET_ICON_NAMES.slice(49, 56)).toEqual(Object.keys(s17)); // after S19's two (47, 49); the GM's coin icons follow (K15)
    for (const [name, author] of Object.entries(s17)) {
      const icon = ICON_SET[name as keyof typeof ICON_SET];
      expect(icon.author.name, name).toBe(author);
      const { container, unmount } = render(<Icon name={name as keyof typeof ICON_SET} />);
      expect(container.querySelector('path')!.getAttribute('d'), name).toBe(icon.d);
      unmount();
    }
  });

  // Purpose (S8b; page 16, T2): Waiting for you's two new answers' icons, the rest's Answer… (the scroll and quill,
  // ic-4) and the weather's Enter… (the rolling dice), are in the table after the coins, each by Delapouite as the
  // Studio's CREDITS.md gives, each resolving.
  it('holds Waiting for you’s scroll and quill and rolling dice, each by Delapouite, each resolving', () => {
    // (slice(43, 45), after the Player screen's jug at 42: the journey (S5) and the picture piece's easel (TW13, ic-4) follow them.)
    expect(SET_ICON_NAMES.slice(43, 45)).toEqual(['scroll-quill', 'rolling-dices']);
    for (const name of ['scroll-quill', 'rolling-dices'] as const) {
      expect(ICON_SET[name].author.name).toBe('Delapouite');
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[name].d);
      unmount();
    }
  });

  // Purpose: Depart's journey (ic-5, S5) is in the table after Waiting for you's two, by Lorc as the Studio's CREDITS.md gives, resolving.
  it('holds Depart’s journey icon, by Lorc, resolving', () => {
    expect(SET_ICON_NAMES.slice(45, 46)).toEqual(['journey']);
    expect(ICON_SET.journey.author.name).toBe('Lorc');
    const { container, unmount } = render(<Icon name="journey" />);
    expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.journey.d);
    unmount();
  });

  // Purpose: the card after an expedition ends (S19) has Heal's bundle of herbs and Undo's turned-back arrow (ic-2) in
  // the table, after the easel, each by Delapouite as the Studio's CREDITS.md gives, each resolving.
  it('holds Heal’s herbs and Undo’s arrow, each by Delapouite, each resolving', () => {
    expect(SET_ICON_NAMES.slice(47, 49)).toEqual(['herbs-bundle', 'anticlockwise-rotation']);
    for (const name of ['herbs-bundle', 'anticlockwise-rotation'] as const) {
      expect(ICON_SET[name].author.name).toBe('Delapouite');
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[name].d);
      unmount();
    }
  });

  // Purpose: the GM's coin acts (K15, Francis 2026-11-18), Take coin's grabbing hand by Lorc and Give coin's coins into
  // a hand by Delapouite, come after the Scene's icons (S8b to S17), each resolving to its own path; the Player screen's
  // button icons (dec-13 C6) follow them.
  it('holds the GM’s two coin icons, grab by Lorc and receive-money by Delapouite, each resolving', () => {
    expect(SET_ICON_NAMES.slice(56, 58)).toEqual(['grab', 'receive-money']);
    expect(ICON_SET.grab.author.name).toBe('Lorc');
    expect(ICON_SET['receive-money'].author.name).toBe('Delapouite');
    for (const name of ['grab', 'receive-money'] as const) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[name].d);
      unmount();
    }
  });

  // Purpose (B16; pf-25, p2p-30): the four pictures for the ways' buttons come before the jigsaw in the table, Row's crossed oars
  // and Swim's two fish by Delapouite (mc-79a), Walk's leather boot by Lorc (ap-10) and Climb's climber by Caro
  // Asercion (⚑ 11, ruled 2026-11-19), as the Studio's CREDITS.md gives them, each under the plain name the Credits
  // show, each resolving to its own path.
  it('holds the ways’ four pictures, the oars and the fish by Delapouite, the boot by Lorc and the climber by Caro Asercion, each resolving', () => {
    const ways: Record<string, { author: string; plain: string }> = {
      paddles: { author: 'Delapouite', plain: 'Oars' },
      'double-fish': { author: 'Delapouite', plain: 'Fish' },
      'leather-boot': { author: 'Lorc', plain: 'Leather boot' },
      'mountain-climbing': { author: 'Caro Asercion', plain: 'Climber' },
    };
    expect(SET_ICON_NAMES.slice(66, 70)).toEqual(Object.keys(ways));
    for (const [name, { author, plain }] of Object.entries(ways)) {
      const icon = ICON_SET[name as keyof typeof ICON_SET];
      expect(icon.author.name, name).toBe(author);
      expect(icon.plain, name).toBe(plain);
      const { container, unmount } = render(<Icon name={name as keyof typeof ICON_SET} />);
      expect(container.querySelector('path')!.getAttribute('d'), name).toBe(icon.d);
      unmount();
    }
  });

  // Purpose (B3; page 23, LA1 and LA4; Francis 2026-11-19: "Yes, as the frame"): the jigsaw for "+ Piece" comes last in
  // the table, by Lorc as the Studio's CREDITS.md gives it, under the plain name the Credits show, resolving to its path.
  it('holds the jigsaw for + Piece, by Lorc, after the ways, resolving', () => {
    expect(SET_ICON_NAMES.slice(70, 71)).toEqual(['jigsaw-piece']);
    const icon = ICON_SET['jigsaw-piece'];
    expect(icon.author.name).toBe('Lorc');
    expect(icon.plain).toBe('Jigsaw piece');
    const { container } = render(<Icon name="jigsaw-piece" />);
    expect(container.querySelector('path')!.getAttribute('d')).toBe(icon.d);
  });

  // Purpose (tfh-1; page 26, frames M2l to M2n, approved 2026-11-19): Drop's dropped sword on the At hand pop-up comes
  // last in the table, by Skoll as the Studio's CREDITS.md gives it (no link: the set's licence file gives none), under
  // the plain name the Credits show, resolving to its own path.
  it('holds the dropped sword for Drop, by Skoll, last, resolving', () => {
    expect(SET_ICON_NAMES.slice(71, 72)).toEqual(['drop-weapon']);
    const icon = ICON_SET['drop-weapon'];
    expect(icon.author.name).toBe('Skoll');
    expect(icon.author.url).toBeUndefined();
    expect(icon.plain).toBe('Dropped sword');
    const { container } = render(<Icon name="drop-weapon" />);
    expect(container.querySelector('path')!.getAttribute('d')).toBe(icon.d);
  });

  // Purpose (P7; PL4b and page 40, p7-4): the call card's two marks, the stabbed note for a call to adventure (by
  // Delapouite) and the beer stein for a rumour (by Lorc), come last in the table, each resolving to its own path.
  it('holds the call card’s stabbed note and beer stein, last, each with its author, resolving', () => {
    expect(SET_ICON_NAMES.slice(72)).toEqual(['stabbed-note', 'beer-stein']);
    expect(ICON_SET['stabbed-note'].author.name).toBe('Delapouite');
    expect(ICON_SET['beer-stein'].author.name).toBe('Lorc');
    for (const name of ['stabbed-note', 'beer-stein'] as const) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[name].d);
      unmount();
    }
  });

  // Purpose: the Credits' plain names say what each picture shows (the Studio's names, via the lead, 2026-11-14).
  it('gives the renamed icons their plain names', () => {
    expect(Object.fromEntries((['run', 'trail', 'night-vision', 'cancel', 'awareness', 'confirmed', 'magic-palm', 'spell-book', 'open-palm', 'open-chest'] as const).map((n) => [n, ICON_SET[n].plain]))).toEqual({
      run: 'Running figure',
      trail: 'Winding path',
      'night-vision': 'Eyes in the dark',
      cancel: 'Cross in a circle',
      awareness: 'Watchful figure',
      confirmed: 'Tick in a circle',
      'magic-palm': 'Hand with a star',
      'spell-book': 'Open book with sparks',
      'open-palm': 'Open hand',
      'open-chest': 'Open chest',
    });
  });

  // Purpose: every icon taken is recorded with its name, an author (with their link, where the set's licence file
  // gives one; it gives none for Caro Asercion or Skoll) and the set's licence, so the Credits can name them.
  it('gives every icon an author and a licence', () => {
    for (const name of SET_ICON_NAMES) {
      const icon = ICON_SET[name];
      expect(icon.name).toBe(name);
      expect(icon.author.name.trim()).not.toBe('');
      if (icon.author.name === 'Caro Asercion' || icon.author.name === 'Skoll') expect(icon.author.url).toBeUndefined();
      else expect(icon.author.url).toMatch(/^https?:\/\/\S+$/);
      expect(icon.licence).toEqual(CC_BY_3);
      expect(icon.licence).toEqual({ name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' });
      expect(icon.source.name).toBe('game-icons.net');
    }
  });

  // Purpose: each icon's source .svg is kept in the repo, and the path in the table is the one in that file, so neither drifts.
  it('matches every icon to its source file, and keeps no file without a row', () => {
    expect(svgFiles.map((p) => p.replace(/^.*\/(.*)\.svg$/, '$1')).sort()).toEqual([...SET_ICON_NAMES].sort());
    for (const name of SET_ICON_NAMES) {
      const svg = read(`/src/ui/iconSet/${name}.svg`);
      // The whole file, as the set publishes it: its square background, then the icon's one path.
      expect(svg.trim()).toBe(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 0h512v512H0z"/><path fill="#fff" d="${ICON_SET[name].d}"/></svg>`);
    }
  });

  // Purpose: a name from the set draws the filled variant on the 512 grid, in the text colour, hidden from screen readers.
  it('draws a set icon filled on the 512 grid', () => {
    const { container } = render(<Icon name="hourglass" size={32} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 512 512');
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.getAttribute('stroke')).toBeNull();
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('path')).toHaveLength(1);
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.hourglass.d);
  });

  // Purpose: the old line icons keep their names and their stroked 24 grid (they change only at the sweep).
  it('keeps the old line icons as they were', () => {
    const { container } = render(<Icon name="scene" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
  });

  // Purpose: only the table's names count as set icons.
  it('tells a set name from any other', () => {
    expect(isSetIconName('crystal-ball')).toBe(true);
    expect(['scene', 'lantern-moth', '', undefined, 3, 'toString'].some(isSetIconName)).toBe(false);
  });
});

describe('a way of travelling’s icon (pf-25’s reader; B16, p2p-30)', () => {
  // Purpose: a way the pack calls row reads the crossed oars, swim the two fish and walk the leather boot, with no icon named by the pack.
  it('reads row as the oars, swim as the two fish and walk as the boot', () => {
    expect(wayIconOf({ by: 'row' })).toBe('paddles');
    expect(wayIconOf({ by: 'swim' })).toBe('double-fish');
    expect(wayIconOf({ by: 'walk' })).toBe('leather-boot');
  });

  // Purpose (ruled 2026-11-19, ⚑ 11: "Go with proposed"; page 18, PL7, ap-10): a way by climb shows the climber.
  it('reads climb as the climber', () => {
    expect(wayIconOf({ by: 'climb' })).toBe('mountain-climbing');
  });

  // Purpose: a way's own icon, where the pack names one from the app's set, wins over the picture its `by` would read.
  it('lets a way’s own icon win over its by', () => {
    expect(wayIconOf({ by: 'row', icon: 'water-splash' })).toBe('water-splash');
    expect(wayIconOf({ by: 'wade', icon: 'leather-boot' })).toBe('leather-boot');
  });

  // Purpose: a way the app has no picture for gives no icon, so its button shows its word alone: an invented way, a
  // route's one unnamed amount, a name that only looks like one (an object's own method), and a known id in capitals.
  it('gives an unknown way no icon', () => {
    for (const by of ['wade', '', 'toString', 'Row', 'Climb']) expect(wayIconOf({ by }), by).toBeNull();
  });

  // Purpose: an icon the app's set lacks gives no icon (pf-25: it "falls back to the mark"); it is never swapped for
  // the picture of the way's `by`, and a line icon's or a status symbol's name is not a name from the set.
  it('gives no icon for an icon the set lacks, even on a way it knows', () => {
    expect(wayIconOf({ by: 'row', icon: 'lantern-moth' })).toBeNull();
    expect(wayIconOf({ by: 'swim', icon: 'scene' })).toBeNull();
    expect(wayIconOf({ by: 'walk', icon: 'toString' })).toBeNull();
  });

  // Purpose: the icon a pack names on a way comes through the route's reader as written (trimmed), so the reader
  // above gets it; a way that names none carries none, and an icon that isn't words is left out, never guessed.
  it('reads a way’s icon from the pack’s route, and leaves out one that isn’t words', () => {
    const ways = routeWays([
      { by: 'wade', name: 'Wade', icon: ' leather-boot ', value: 2, unit: 'turn' },
      { by: 'row', name: 'Row', value: 1, unit: 'turn' },
      { by: 'swim', name: 'Swim', icon: 7, value: 3, unit: 'turn' },
      { by: 'walk', name: 'Walk', icon: '  ', value: 4, unit: 'turn' },
    ]);
    expect(ways).toEqual([
      { by: 'wade', name: 'Wade', icon: 'leather-boot', value: 2, unit: 'turn' },
      { by: 'row', name: 'Row', value: 1, unit: 'turn' },
      { by: 'swim', name: 'Swim', value: 3, unit: 'turn' },
      { by: 'walk', name: 'Walk', value: 4, unit: 'turn' },
    ]);
    expect(ways.map((way) => 'icon' in way)).toEqual([true, false, false, false]);
    expect(ways.map(wayIconOf)).toEqual(['leather-boot', 'paddles', 'double-fish', 'leather-boot']);
    // A route that gives one amount has one unnamed way: no icon to read, and none shown.
    expect(routeWays({ value: 2, unit: 'turn', icon: 'paddles' })).toEqual([{ by: '', name: '', value: 2, unit: 'turn' }]);
  });
});

describe('a pack icon name still resolves (pf-12c)', () => {
  // Purpose: every name on the pack format's step-symbol list and status-symbol list keeps resolving to what it drew before.
  it('resolves every name on the format’s two closed lists', () => {
    for (const name of STEP_ICON_NAMES) expect(packIconOf(name, 'step'), name).toMatchObject({ from: 'step', name });
    for (const name of STATUS_SYMBOLS) expect(packIconOf(name, 'condition'), name).toEqual({ from: 'status', name });
  });

  // Purpose: a step symbol with no line icon of its own (going astray) still resolves, to its letter as today.
  it('resolves a step symbol that has no drawing to its letter', () => {
    expect(packIconOf('lost', 'step')).toEqual({ from: 'step', name: 'lost', drawn: false });
    expect(packIconOf('camp', 'step')).toEqual({ from: 'step', name: 'camp', drawn: true });
  });

  // Purpose: a step's icon or a rule's button may name an icon from the set; a condition's icon may not (pf-12c names steps and buttons only).
  it('resolves a set name on a step and a button, not on a condition', () => {
    expect(packIconOf('trumpet-flag', 'step')).toEqual({ from: 'set', name: 'trumpet-flag' });
    expect(packIconOf('water-splash', 'condition')).toBeNull();
  });

  // Purpose: an unknown or missing name resolves to nothing, so the caller shows its fallback.
  it('resolves an unknown name to nothing', () => {
    expect(packIconOf('lantern-moth', 'step')).toBeNull();
    expect(packIconOf('lantern-moth', 'condition')).toBeNull();
    expect(packIconOf(undefined, 'step')).toBeNull();
    expect(packIconOf(7, 'condition')).toBeNull();
  });

  // Purpose: every icon name the repo's own pack files use (scripts/fixtures, in the pack format; the private packs
  // aren't in the repo) still resolves. The expedition test fixtures are left out: one names an unknown icon on purpose.
  it('resolves every icon name in the repo’s pack fixtures', () => {
    const found = fixtureFiles.flatMap((path) => iconNamesIn(JSON.parse(read(path))).map((use) => ({ ...use, path })));
    expect(found.length).toBeGreaterThan(20);
    const unresolved = found.filter((use) => packIconOf(use.name, use.field) === null);
    expect(unresolved).toEqual([]);
  });

  // Purpose: the walk that finds pack icon names reads a condition's icon as a status symbol and a rule's button as a step icon.
  it('finds icon names by the field they sit in', () => {
    const pack = { conditions: [{ id: 'fen-sting', icon: 'drop' }], rulesSets: [{ modes: [{ procedure: [{ id: 'peer', icon: 'search' }] }] }], rules: [{ id: 'tolls', button: 'locked-chest' }] };
    expect(iconNamesIn(pack)).toEqual([
      { name: 'drop', field: 'condition' },
      { name: 'search', field: 'step' },
      { name: 'locked-chest', field: 'step' },
    ]);
  });
});
