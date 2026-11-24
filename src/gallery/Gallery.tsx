// The component gallery (docs/06 "Gallery and screenshot tests"; ruled 2026-10-25): every part of the component
// inventory in its states, on the real tokens, with invented sample data. A hidden page (gallery.html), never linked
// from the app. ?theme=light|dark, ?size=standard|large|larger and ?motion=reduced set the page for screenshots.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BRAND } from '../brand.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { DeviceMenuSection, MenuItem, MenuItems, MoreMenu } from '../ui/MoreMenu.tsx';
import { AppVersionSection, BuildContext, READY_WORDS, STAND_IN_BUILD } from '../app/AppUpdate.tsx';
import { AboutThisApp } from '../app/AboutThisApp.tsx';
import { PhoneNavSpecimens } from './PhoneNavSpecimens.tsx';
import { PlayersStandardSpecimens } from './PlayersStandardSpecimens.tsx';
import { PlayerStatesSpecimens } from './PlayerStatesSpecimens.tsx';
import { FullSheetSpecimens } from './FullSheetSpecimens.tsx';
import { SheetRevisedSpecimens } from './SheetRevisedSpecimens.tsx';
import { PatronSpecimens } from './PatronSpecimens.tsx';
import { BookType } from '../ui/creation.tsx';
import { PatronFirstDialog } from '../app/GuidedCreation.tsx';
import { StockRowSpecimens } from './StockRowSpecimens.tsx';
import { TappedTableSpecimens } from './TappedTableSpecimens.tsx';
import { StandardPartsSpecimens } from './StandardPartsSpecimens.tsx';
import { MapPartsSpecimens } from './MapPartsSpecimens.tsx';
import { MoveOnSpecimens } from './MoveOnSpecimens.tsx';
import { KnowledgeSpecimens } from './KnowledgeSpecimens.tsx';
import { PlayersPlaceCardSpecimens } from './PlayersPlaceCardSpecimens.tsx';
import { CallCardSpecimens } from './CallCardSpecimens.tsx';
import { TraitListSpecimens } from './TraitListSpecimens.tsx';
import { GmAttentionSpecimens } from './GmAttentionSpecimens.tsx';
import {
  ActionBar,
  ButtonRow,
  Chip,
  ChoiceCard,
  DamagePad,
  DestinationList,
  GuidedInstruction,
  HowMany,
  HpBar,
  Breakdown,
  CloseButton,
  InfoButton,
  ListRow,
  Note,
  OfflinePill,
  OptionRow,
  RowList,
  SaveRow,
  SkeletonRows,
  SkillGrid,
  TraitChips,
  SourceLine,
  SpellLevel,
  StatRow,
  StatTile,
  StatusSymbol,
  Stepper,
  Switch,
  SyncTag,
  Toast,
  UseDots,
  type Destination,
} from '../ui/parts.tsx';
import { PinnedNote, ReviewScreen, RulesForThisCampaign, type RuleGroup } from '../ui/organisms.tsx';
import { applyTextSize, type TextSize } from '../ui/textSize.ts';
import { applyThemeChoice } from '../ui/theme.ts';
import './Gallery.css';
import { CreationReviewSpecimens } from './CreationReviewSpecimens.tsx';
import { CreationShellSpecimens } from './CreationShellSpecimens.tsx';
import { CreationFinalSpecimens } from './CreationFinalSpecimens.tsx';
import { CreationFinalDSpecimens } from './CreationFinalDSpecimens.tsx';
import { CreationWhoSpecimens } from './CreationWhoSpecimens.tsx';
import { CreationGearSpecimens } from './CreationGearSpecimens.tsx';
import { CreationLongTablesSpecimens } from './CreationLongTablesSpecimens.tsx';
import { EndSafetySpecimens } from './EndSafetySpecimens.tsx';
import { NightRestSpecimens } from './NightRestSpecimens.tsx';
import { PrepareSpecimens } from './PrepareSpecimens.tsx';
import { PackLoadSpecimens } from './PackLoadSpecimens.tsx';
import { PackStandardSpecimens } from './PackStandardSpecimens.tsx';
import { AtHandSpecimens } from './AtHandSpecimens.tsx';
import { SameNameSpecimens } from './SameNameSpecimens.tsx';
import { WildernessSpecimens } from './WildernessSpecimens.tsx';
import { PlacesSpecimens } from './PlacesSpecimens.tsx';
import { StatBlockSpecimens } from './StatBlockSpecimens.tsx';
import { StackedButtonSpecimens } from './StackedButtonSpecimens.tsx';
import { SheetFootSpecimens } from './SheetFootSpecimens.tsx';
import { LevelNameSpecimens } from './LevelNameSpecimens.tsx';
import { WeatherSheetSpecimens } from './WeatherSheetSpecimens.tsx';
import { MagicBlock } from '../ui/MagicBlock.tsx';
import { magicOf } from '../modules/characters/magic.ts';

const COLOUR_TOKENS = ['page', 'surface', 'sheet', 'ink', 'muted', 'rule', 'control', 'accent', 'on-accent', 'warning', 'danger', 'info', 'tint', 'selected', 'selected-edge', 'light-glow', 'dark-sight'];
const RAMPS = ['accent', 'warning', 'danger', 'info'];
const TEXT_STEPS = [14, 16, 20, 24, 30, 36, 48];
const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8];

/** WCAG contrast between two colours read from the page's tokens. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// The Magic section's specimens (sr-4), from the same reader as the sheet. Invented names.
const MAGIC_SPELLS = [
  { packEntryId: 'glimmer', name: 'Glimmer', data: { duration: { value: 3, unit: 'turn' }, range: '40 ft' } },
  { packEntryId: 'reed-whisper', name: 'Reed whisper', data: { duration: 'instant', range: 'touch' } },
  { packEntryId: 'long-lantern', name: 'The long lantern of the drowned abbey that burns beneath the black water until dawn', data: { duration: { value: 1, unit: 'night' }, range: '50 ft' } },
  { packEntryId: 'heron-hush', name: 'Heron hush', data: { duration: '4 turns', range: 'self' } },
];
const MAGIC_LISTS = [
  { packEntryId: 'lamp-lore', name: 'Lamp lore', data: { levels: [{ level: 1, spells: ['glimmer', 'reed-whisper'] }, { level: 2, spells: ['long-lantern'] }] } },
  { packEntryId: 'glamours', name: 'Glamours', data: { levels: [{ level: 1, spells: ['heron-hush'] }] } },
];
const MAGIC_CLASS = { packEntryId: 'lantern-warden', name: 'Warden', data: { spellcasting: { listId: 'lamp-lore', type: 'book', fromLevel: 1, firstSpells: { given: ['glimmer'] } } } };
const magicFor = (book: string[], prepared: { spell: string; level: number }[]) => magicOf({ klass: MAGIC_CLASS, race: null, level: 3, book, prepared, slots: [3, 2], spells: MAGIC_SPELLS, lists: MAGIC_LISTS })!;
const GALLERY_MAGIC = magicFor(['glimmer', 'reed-whisper', 'long-lantern', 'heron-hush'], [{ spell: 'glimmer', level: 1 }]);
const GALLERY_MAGIC_EMPTY = magicFor([], []);
// Design's three more states (on #482): six spell levels with one at none; five kinds; a long list and nothing prepared.
const MANY_SPELLS = ['Ember', 'Fen light', 'Hush', 'Knot', 'Lull', 'Mist step', 'Otter tongue', 'Pike sense', 'Rain call', 'Sedge bind', 'Tallow ward'].map((name, i) => ({
  packEntryId: `many-${i}`,
  name,
  data: { duration: `${i + 2} turns`, range: `${(i + 1) * 5} ft` },
}));
const KIND_SPELLS = [
  { packEntryId: 'rune-reed', name: 'Reed rune', data: { range: 'touch' } },
  { packEntryId: 'knack-mud', name: 'Mud knack', data: { range: 'self' } },
];
const MORE_LISTS = [
  ...MAGIC_LISTS,
  { packEntryId: 'many-list', name: 'Fen tricks', data: { levels: [{ level: 1, spells: MANY_SPELLS.map((m) => m.packEntryId) }] } },
  { packEntryId: 'runes', name: 'Runes', data: { levels: [{ level: 1, spells: ['rune-reed'] }] } },
  { packEntryId: 'knacks', name: 'Knacks', data: { levels: [{ level: 1, spells: ['knack-mud'] }] } },
];
const MORE_SPELLS = [...MAGIC_SPELLS, ...MANY_SPELLS, ...KIND_SPELLS];
const GALLERY_MAGIC_LEVELS = magicOf({ klass: MAGIC_CLASS, race: null, level: 9, book: ['glimmer'], prepared: [], slots: [4, 3, 3, 0, 2, 1], spells: MAGIC_SPELLS, lists: MAGIC_LISTS })!;
const GALLERY_MAGIC_KINDS = magicOf({ klass: MAGIC_CLASS, race: null, level: 3, book: ['glimmer', 'reed-whisper', 'heron-hush', 'rune-reed', 'knack-mud'], prepared: [{ spell: 'glimmer', level: 1 }], slots: [3, 2], spells: MORE_SPELLS, lists: MORE_LISTS })!;
const GALLERY_MAGIC_LONG = magicOf({ klass: { packEntryId: 'fen-trickster', name: 'Trickster', data: { spellcasting: { listId: 'many-list', fromLevel: 1 } } }, race: null, level: 5, book: MANY_SPELLS.map((m) => m.packEntryId), prepared: [], slots: [], spells: MORE_SPELLS, lists: MORE_LISTS })!;
const GALLERY_MAGIC_PRAYS = magicOf({ klass: { packEntryId: 'reed-chaplain', name: 'Chaplain', data: { spellcasting: { listId: 'lamp-lore', type: 'divine', fromLevel: 1 } } }, race: null, level: 2, book: [], prepared: [], slots: [2], spells: MAGIC_SPELLS, lists: MAGIC_LISTS })!;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  // Whole pixels (fix-gallery-flake): text sizes times line heights leave sections a fraction of a pixel tall, so a
  // part added in one section moved every later section by a fraction and redrew their pictures 1 px off. A little
  // space at the foot (under 1 px, measured, so not a design value) rounds each section up to a whole pixel; the
  // first starts on one, so every section does.
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section || typeof ResizeObserver !== 'function') return;
    // A wrapper with no box of its own (creation's book type, `display: contents`) is looked through to what it holds:
    // it measures nothing and never resizes (fix-gallery-whole-pixels).
    const boxed = (el: Element | null): Element | null => {
      let at = el;
      while (at && getComputedStyle(at).display === 'contents') at = at.lastElementChild;
      return at;
    };
    const snap = () => {
      const last = boxed(section.lastElementChild);
      if (!last) return;
      const natural = last.getBoundingClientRect().bottom - section.getBoundingClientRect().top;
      section.style.paddingBottom = `${Math.ceil(natural - 1e-3) - natural}px`;
    };
    const watch = new ResizeObserver(snap);
    const observe = (el: Element) => (getComputedStyle(el).display === 'contents' ? [...el.children].forEach(observe) : watch.observe(el));
    for (const child of section.children) observe(child);
    snap();
    return () => watch.disconnect();
  }, []);
  return (
    <section ref={ref} className="gallery__section" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="gallery__title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure className="gallery__specimen">
      <figcaption className="gallery__caption">{name}</figcaption>
      <div className="gallery__stage">{children}</div>
    </figure>
  );
}

const destinations: Destination[] = [
  { id: 'hand', name: 'In hand', group: 'Equipped', room: '1 hand free' },
  { id: 'worn', name: 'Worn', group: 'Equipped', blocked: "Lantern Wardens can't wear heavy armor." },
  { id: 'backpack', name: 'Backpack', group: 'Containers', room: '4 of 10 left' },
  { id: 'sack', name: 'Reed sack (small, waxed, with the long strap)', group: 'Containers', blocked: 'Full' },
  { id: 'stash', name: 'Party stash', group: 'Party', room: 'No limit' },
];

const applyMotion = (reduced: boolean) => {
  if (reduced) document.documentElement.dataset.motion = 'reduced';
  else delete document.documentElement.dataset.motion;
};

// The page as the address asks for it, set before the first render.
const START = (() => {
  const params = new URLSearchParams(window.location.search);
  const theme: 'light' | 'dark' = params.get('theme') === 'dark' ? 'dark' : 'light';
  const asked = params.get('size');
  const size: TextSize = asked === 'large' || asked === 'larger' ? asked : 'standard';
  const reduced = params.get('motion') === 'reduced';
  applyThemeChoice(theme);
  applyTextSize(size);
  applyMotion(reduced);
  return { theme, size, reduced };
})();

const RULE_GROUPS: RuleGroup[] = [
  {
    id: 'characters',
    name: 'Characters',
    rules: [
      {
        id: 'start',
        name: 'New characters start at',
        source: BRAND.appName,
        defaultValue: 'one',
        value: 'lowest',
        choices: [
          { value: 'one', label: 'Level 1', meaning: 'Everyone starts at the beginning.' },
          { value: 'lowest', label: "Party's lowest", meaning: 'Matches the lowest active character, currently 3.' },
          { value: 'fixed', label: 'Fixed level', meaning: 'You choose the level; capped at each class’s maximum.' },
          { value: 'propose', label: 'Player proposes, GM approves', meaning: 'The player picks; you approve or ask for another.' },
        ],
      },
      { id: 'approval', name: 'New characters need approval', source: BRAND.appName, defaultValue: 'yes', value: 'yes', choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    ],
  },
  {
    id: 'adventuring',
    name: 'Adventuring',
    rules: [{ id: 'oil', name: 'Lanterns need oil', source: 'River Rules', defaultValue: 'yes', value: 'yes', choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] }], // words: names
  },
  {
    id: 'items',
    name: 'Items and treasure',
    rules: [{ id: 'recharge', name: 'Charged items can be recharged', source: BRAND.appName, defaultValue: 'no', value: 'yes', choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] }],
  },
];

export function Gallery() {
  const [theme, setTheme] = useState<'light' | 'dark'>(START.theme);
  const [size, setSize] = useState<TextSize>(START.size);
  const [reduced, setReduced] = useState(START.reduced);
  // The page's settings change before the next render, so the contrast figures read the new tokens.
  const chooseTheme = (next: 'light' | 'dark') => {
    applyThemeChoice(next);
    setTheme(next);
  };
  const chooseSize = (next: TextSize) => {
    applyTextSize(next);
    setSize(next);
  };
  const chooseMotion = (next: boolean) => {
    applyMotion(next);
    setReduced(next);
  };

  const [row, setRow] = useState<'coin' | 'slot' | null>('coin');
  const [count, setCount] = useState(6);
  const [on, setOn] = useState(true);
  const [picked, setPicked] = useState('backpack');
  const [reason, setReason] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>('Dropped 3 torches');
  const [dialog, setDialog] = useState(false);
  const [groups, setGroups] = useState(RULE_GROUPS);
  // The specimen shows its first group open (on the screen they start collapsed).
  const [rulesOpen, setRulesOpen] = useState<string[]>(RULE_GROUPS[0] ? [RULE_GROUPS[0].id] : []);
  const addTo = (
    <button type="button" className="button-primary">
      Add to {destinations.find((d) => d.id === picked)?.name ?? 'pack'}
    </button>
  );
  const review = (layout: 'auto' | 'phone' = 'auto') => (
    <ReviewScreen
      layout={layout}
      heading="Wren, Lantern Warden" // words: names
      note={<PinnedNote from="Priya (GM)" title="Your GM asks for a change" by="Priya, your GM, today">Please roll HP again; 9 is above the dice for level 1.</PinnedNote>}
      sections={[
        { id: 'scores', title: 'Scores', lines: [{ text: 'STR 13, INT 9, WIS 16 (rolled 14), DEX 11, CON 12, CHA 8' }, { text: 'WIS 16', mark: 'override', why: 'traded 2 STR, as the setting allows' }] },
        { id: 'hp', title: 'Hit points', flagged: true, lines: [{ text: 'HP 9', mark: 'broken', why: 'above 1d6' }] },
        { id: 'gear', title: 'Gear', lines: [{ text: "Delver's kit, Lantern, Short bow and 20 arrows" }] },
        { id: 'money', title: 'Starting money', lines: [{ text: '11 rolled, 14 gp spent: 3 gp over.' }, { text: 'over by 3 gp, gold starts at 0 if the GM approves', mark: 'broken' }] },
      ]}
      action="Send to the GM"
      stillNeeded={['Enter your HP again']}
      onOpenStep={() => undefined}
      onAction={() => undefined}
      onExplain={(needed) => setReason(`Still to do: ${needed.join(', ')}.`)}
    />
  );
  const setRule = (ruleId: string, value: string) =>
    setGroups((all) => all.map((g) => ({ ...g, rules: g.rules.map((r) => (r.id === ruleId ? { ...r, value } : r)) })));

  return (
    <main className="gallery">
      <header className="gallery__head">
        <h1 className="gallery__h1">Component gallery</h1>
        <div className="gallery__controls">
          <ButtonRow label="Theme" options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} value={theme} onChange={chooseTheme} />
          <ButtonRow
            label="Text size"
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'large', label: 'Large' },
              { value: 'larger', label: 'Larger' },
            ]}
            value={size}
            onChange={chooseSize}
          />
          <Switch label="Reduced motion" on={reduced} onChange={chooseMotion} />
        </div>
      </header>

      <Section id="colour" title="Colour tokens">
        <div className="gallery__swatches">
          {COLOUR_TOKENS.map((name) => {
            const value = token(name);
            const onPage = /^#[0-9a-f]{6}$/i.test(value) && /^#[0-9a-f]{6}$/i.test(token('page')) ? contrast(value, token('page')) : null;
            return (
              <div key={name} className="gallery__swatch">
                <span className="gallery__chip" style={{ background: `var(--${name})` }} aria-hidden="true" />
                <span className="gallery__swatch-name">{name}</span>
                <span className="gallery__swatch-value">
                  {value}
                  {onPage !== null && name !== 'page' && `, ${onPage.toFixed(1)}:1 on page`}
                </span>
              </div>
            );
          })}
        </div>
        {RAMPS.map((ramp) => (
          <div key={ramp} className="gallery__ramp" role="group" aria-label={`${ramp} ramp`}>
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className="gallery__ramp-step" style={{ background: `var(--${ramp}-${step})` }}>
                <span className="gallery__ramp-label">
                  {ramp} {step}
                </span>
              </span>
            ))}
          </div>
        ))}
        <div className="gallery__ramp" role="group" aria-label="neutral ramp">
          {[1, 2, 3, 4, 5, 6, 7].map((step) => (
            <span key={step} className="gallery__ramp-step" style={{ background: `var(--neutral-${step})` }} />
          ))}
        </div>
        <Specimen name="Never colour alone: the warning sign, ✕ danger, ⓘ info">
          <Note tone="warning">Your torch has 1 turn left.</Note>
          <Note tone="danger">INT can't be above 18. Lower it to continue.</Note>
          <Note tone="info">Magic resistance is added to saves against spells.</Note>
        </Specimen>
      </Section>

      <Section id="type" title="Type and spacing">
        {TEXT_STEPS.map((step) => (
          <p key={step} className={`gallery__type gallery__type--${step}`}>
            {step}, {step >= 20 ? 'Wren of the Lantern Wardens 14' : 'Wren gave Bram 3 rations. 0, 999'} {/* words: names */}
          </p>
        ))}
        <p className="gallery__reading">
          Reading text stops at about 65 characters a line on a tablet. Magic resistance is added to saves against spells and against the breath of
          bog lurkers, and it ends when the charm is taken off.
        </p>
        <div className="gallery__spaces">
          {SPACE_STEPS.map((step) => (
            <span key={step} className="gallery__space">
              <span className="gallery__space-bar" style={{ inlineSize: `var(--space-${step})` }} />
              space-{step}
            </span>
          ))}
        </div>
      </Section>

      <Section id="atoms" title="Atoms">
        <Specimen name="Buttons: primary, secondary, small secondary, busy; a link only goes somewhere (fl-1)">
          <div className="gallery__row">
            <button type="button" className="button-primary">
              Send to the GM
            </button>
            <button type="button" className="button-secondary">
              Add item
            </button>
            <button type="button" className="button-secondary button-secondary--small">
              Recharge (fiat)
            </button>
            <button type="button" className="button-secondary button-secondary--small">
              Delete
            </button>
            <button type="button" className="button-secondary" aria-busy="true">
              Saving…
            </button>
            <button type="button" className="button-quiet">
              ‹ Back to the list
            </button>
          </div>
        </Specimen>
        <Specimen name="Button row (fits one row) and none chosen">
          <ButtonRow label="Encumbrance" options={[{ value: 'coin', label: 'Coin' }, { value: 'slot', label: 'Slot' }]} value={row} onChange={setRow} />
          <ButtonRow label="Alignment" options={[{ value: 'a', label: 'Lawful' }, { value: 'b', label: 'Neutral' }, { value: 'c', label: 'Chaotic' }]} value={null} onChange={() => undefined} />
        </Specimen>
        <Specimen name="Text field, stepper, switch, chips (action chips outlined; a toggle chip fills when on), ⓘ">
          <label className="gallery__field">
            <span className="label">Name</span>
            <input className="gallery__input" defaultValue="Wren" />
          </label>
          <Stepper label="torches" value={count} min={0} max={999} onChange={setCount} />
          <Switch label="Dim pictures in dark mode" on={on} onChange={setOn} />
          <div className="gallery__row">
            <Chip onClick={() => undefined}>−1</Chip>
            <Chip onClick={() => undefined}>All 6</Chip>
            <Chip onClick={() => undefined} pressed>
              Lights only
            </Chip>
            <InfoButton label="Magic resistance" onOpen={() => setReason('Magic resistance is added to saves against spells.')} />
            <CloseButton onClose={() => undefined} />
          </div>
        </Specimen>
        <Specimen name="Guided-flow instruction, source line, archivist ink">
          <GuidedInstruction>Roll your scores and enter them as rolled.</GuidedInstruction>
          <SourceLine>From your setting: River Rules, p. 12</SourceLine>
          <p className="gallery__archivist">The ferryman took two rations and asked no questions.</p>
        </Specimen>
      </Section>

      <Section id="molecules" title="Molecules">
        <Specimen name="Stat tiles (static: tinted, no border): normal, 0, 999">
          <StatRow>
            {/* Labels stored lowercase so small caps render them alike (str, gold, arrows). */}
            <StatTile label="str" value={13} caption="Melee, doors" />
            <StatTile label="gold" value={0} />
            <StatTile label="arrows" value={999} />
          </StatRow>
        </Specimen>
        <Specimen name="Stat tiles, tappable (a tap explains how it's worked out): normal, long, 0">
          <StatRow>
            <StatTile label="hit points" value="9 / 14" onTap={() => undefined} tapLabel="Hit points 9 of 14: how it's worked out" />
            <StatTile label="ac" value={0} onTap={() => undefined} tapLabel="AC 0: how it's worked out" />
            <StatTile label="level" value={14} onTap={() => undefined} tapLabel="Level 14: how it's worked out" />
          </StatRow>
        </Specimen>
        <Specimen name="Status symbols: full, half, low (the warning sign), stacks (ring and badge), hidden timer (track only)">
          <div className="gallery__row">
            <StatusSymbol name="Torch" symbol="T" left={6} of={6} />
            <StatusSymbol name="Blessed" left={3} of={6} />
            <StatusSymbol name="Lantern" symbol="L" left={1} of={24} warn />
            <StatusSymbol name="Exhausted" stacks={2} />
            <StatusSymbol name="Charmed" />
          </div>
        </Specimen>
        <Specimen name="Toast with Undo (8 seconds; the bar holds still under reduced motion)">
          {toast ? (
            <Toast text={toast} onUndo={() => setToast(null)} onDone={() => setToast(null)} seconds={600} />
          ) : (
            <button type="button" className="button-secondary" onClick={() => setToast('Gave 2 rations to Bram')}>
              Show a toast
            </button>
          )}
        </Specimen>
        <Specimen name="Toast, action variant: a new version held back (F55, au-2); Reload switches only when nothing would be lost">
          <Toast text={READY_WORDS} action={{ label: 'Reload', run: () => undefined }} onDone={() => undefined} seconds={600} />
        </Specimen>
        <Specimen name="Dialog (only for irreversible or high-cost actions), shown open; the button opens the real one">
          <Dialog preview label="End the expedition?" onClose={() => undefined}>
            <p>Time stops, lights go out, and the party comes home.</p>
            <div className="dialog__actions">
              <button type="button" className="button-primary">
                End it
              </button>
              <button type="button" className="button-secondary button-secondary--small">
                Not now
              </button>
            </div>
          </Dialog>
          <button type="button" className="button-secondary" onClick={() => setDialog(true)}>
            End expedition
          </button>
        </Specimen>
        <Specimen name="How many (Give, Drop, Move)">
          <HowMany of={6} value={count > 6 ? 6 : Math.max(1, count)} onChange={setCount} />
        </Specimen>
        <Specimen name="Hit-point bar: 1 HP a segment up to 12 (9 of 14 uses 5 a segment), full, part-lost, 0">
          <div className="gallery__col gallery__col--full">
            <HpBar fills={[1, 1, 1, 1, 1, 1, 1, 0, 0, 0]} />
            <HpBar fills={[1, 1, 0.8, 0]} />
            <HpBar fills={[0, 0, 0, 0, 0, 0]} />
          </div>
        </Specimen>
        <Specimen name="Breakdown (sr-8: rows, the to-hit row by AC, where it comes from)">
          <div className="gallery__col">
            <Breakdown
              rows={[
                { label: 'Lantern Warden at level 1', value: '19' },
                { label: 'Melee, muscle +0', value: '19' },
                { label: 'Missile, nimbleness +1', value: '18' },
              ]}
              toHit={Array.from({ length: 10 }, (_, i) => ({ ac: 9 - i, roll: 10 + i }))}
              ending="From the rules: descending AC, the option “Armour and attacks”"
            />
          </div>
        </Specimen>
        <Specimen name="Skills (two columns, the pack's style; long name, 0) and saves (one row, short names)">
          <div className="gallery__col">
            <SkillGrid
              skills={[
                { key: 'HR', name: 'Hide in reeds', value: '2-in-6' },
                { key: 'LW', name: 'Listen at water', value: '1-in-6' },
                { key: 'LONG', name: 'Find the way through the drowned causeway at night', value: '35%' },
                { key: 'Z', name: 'Climb', value: '0%' },
                { key: 'HK', name: 'Hark', value: '5+', tag: 'kindred' },
                { key: 'WD', name: 'Wade the deep pools', value: '6+', tag: '4 when wading' },
              ]}
              onOpen={(key) => setToast(`Opened ${key}`)}
            />
            <SaveRow
              saves={[
                { key: 'R', short: 'River', name: 'Save vs river', value: '12' },
                { key: 'M', short: 'Mire', name: 'Save vs mire', value: '13' },
                { key: 'X', short: 'Save X', name: 'Save X', value: '999' },
              ]}
              onOpen={(key) => setToast(`Opened ${key}`)}
            />
          </div>
        </Specimen>
        <Specimen name="Traits as chips (tc-1 … tc-4: by source, uses as dots with spent ones as rings (1 of 3 left), drawback, a later level; 13 fold after 12; a long name takes its row)">
          <div className="gallery__col gallery__col--full">
            <TraitChips
              groups={[
                {
                  id: 'kindred',
                  title: 'Kindred: Reed kin',
                  chips: [
                    { key: 'k1', name: 'Moon sight', uses: 0, drawback: false, laterLevel: null, label: 'Moon sight' },
                    { key: 'k2', name: 'Wild revelry', uses: 1, drawback: false, laterLevel: null, label: 'Wild revelry, 1 use a day' },
                    { key: 'k3', name: 'Iron-shy', uses: 0, drawback: true, laterLevel: null, label: 'Iron-shy, a drawback' },
                    { key: 'k4', name: 'Knows the hidden paths between the drowned willows of the far fen at dusk', uses: 0, drawback: false, laterLevel: null, label: 'Knows the hidden paths between the drowned willows of the far fen at dusk' },
                    ...['Reed step', 'Mud sense', 'Hush', 'Webbed toes', 'Frog tongue', 'Mist cloak', 'Heron call', 'Root sleep'].map((name, i) => ({ key: `k${i + 5}`, name, uses: 0, drawback: false, laterLevel: null, label: name })),
                    { key: 'k13', name: 'Tide memory', uses: 0, drawback: false, laterLevel: null, label: 'Tide memory' },
                  ],
                },
                {
                  id: 'class',
                  title: 'Calling: Lantern keeper',
                  chips: [
                    { key: 'c1', name: 'Ward the light', uses: 3, spent: 2, drawback: false, laterLevel: null, label: 'Ward the light, 3 uses each rest, 1 of 3 left' },
                    { key: 'c2', name: 'Steady hand', uses: 0, drawback: false, laterLevel: 3, label: 'Steady hand, from level 3' },
                  ],
                },
              ]}
              onOpen={(key) => setToast(`Opened ${key}`)}
            />
          </div>
        </Specimen>
        <Specimen name="Use dots (2 of 3 left, none left) and the Magic tab's spells by level (dots a casting, Cast; a cast one crossed out, last)">
          <div className="gallery__col">
            <UseDots name="Ember ward" uses={3} spent={1} onChange={(n) => setToast(`${3 - n} left`)} />
            <UseDots name="Reed step" uses={1} spent={1} onChange={(n) => setToast(`${1 - n} left`)} />
            <SpellLevel
              level={1}
              slots={2}
              spells={[{ key: 'm', name: 'Mire lamp', line: '6 turns, 30 ft', times: 2, left: 1 }]}
              onOpen={(key) => setToast(`Opened ${key}`)}
              onCast={(key) => setToast(`Cast ${key}`)}
            />
            <SpellLevel
              level={2}
              slots={99}
              spells={[
                { key: 'b', name: 'Beacon', line: 'Until dawn, Touch', times: 1, left: 0 },
                { key: 'h', name: 'Hush of the long fen at the hour before the tide turns', line: '12 turns, 120 ft', times: 1, left: 1 },
              ]}
              onOpen={(key) => setToast(`Opened ${key}`)}
              onCast={(key) => setToast(`Cast ${key}`)}
            />
          </div>
        </Specimen>
        <Specimen name="Damage pad (−5 −1 [N] +1 +5 from the last amount; no fixed quick amounts)">
          <DamagePad target="Wren" start={3} onConfirm={(n, heal) => setToast(heal ? `Healed ${n}` : `Took ${n} damage`)} />
        </Specimen>
        <Specimen name="Offline and sync">
          <div className="gallery__row">
            <OfflinePill kind="offline" waiting={2} onOpen={() => undefined} />
            <OfflinePill kind="catching-up" onOpen={() => undefined} />
            <OfflinePill kind="gm-offline" onOpen={() => undefined} />
            <OfflinePill kind="read-only" onOpen={() => undefined} />
          </div>
          <p>
            HP 9 <SyncTag waiting />, Bram's HP 14 <SyncTag ageMinutes={5} />
          </p>
        </Specimen>
        <Specimen name="⋯ menu, shown open: a symbol beside each option, 48 px rows, This device below a divider; the version and Check for a new version at its foot (F55)">
          <div className="gallery__menu">
            <MoreMenu label="Character options" startOpen>
              <MenuItems>
                <MenuItem icon="characters" onClick={() => undefined}>
                  Your characters
                </MenuItem>
                <MenuItem icon="sheet" onClick={() => undefined}>
                  Full character sheet
                </MenuItem>
                <MenuItem icon="company" onClick={() => undefined}>
                  Company
                </MenuItem>
                <MenuItem icon="scales" onClick={() => undefined}>
                  Setting rules
                </MenuItem>
              </MenuItems>
              <DeviceMenuSection />
              <MenuItems>
                <MenuItem icon="library" onClick={() => undefined}>
                  Rules library
                </MenuItem>
                <MenuItem icon="info" onClick={() => undefined}>
                  About this app
                </MenuItem>
                <MenuItem icon="sign-out" onClick={() => undefined}>
                  Sign out
                </MenuItem>
              </MenuItems>
              <BuildContext.Provider value={STAND_IN_BUILD}>
                <AppVersionSection />
              </BuildContext.Provider>
            </MoreMenu>
          </div>
        </Specimen>
        <Specimen name="About this app (ds-6a; december/08): the app's name and version, Credits from the icon table, the fonts with their licence; the rows scroll under the head">
          <BuildContext.Provider value={STAND_IN_BUILD}>
            <AboutThisApp onClose={() => undefined} preview />
          </BuildContext.Provider>
        </Specimen>
      </Section>

      <Section id="choosing" title="Choosing">
        <Specimen name="Choice cards (one tap moves on; no selected state)">
          <div className="gallery__cards">
            <ChoiceCard title="Guided" summary="Step by step, from your setting." onChoose={() => setToast('Guided creation opens here')} />
            <ChoiceCard title="Freeform" summary="Type in what you rolled." onChoose={() => setToast('Freeform creation opens here')} />
          </div>
        </Specimen>
        <Specimen name="Option rows: chosen, plain, not allowed, a long name">
          <OptionRow name="Lantern Warden" marks="STR, WIS" summary="Keeps the beacons lit; light armor." selected onPick={() => undefined} /> {/* words: names */}
          <OptionRow name="Reed Witch" marks="INT" summary="Hexes and charms from the marsh." onPick={() => undefined} /> {/* words: names */}
          <OptionRow name="Bog Knight" summary="Heavy armor and a long reach." notAllowed="needs STR 13 (you have 9)" onPick={() => setReason('Bog Knights need STR 13. Yours is 9.')} /> {/* words: names */}
          <OptionRow
            name="Keeper of the Seven Drowned Lanterns of Old Reedmouth" // words: names
            summary="A very long name never pushes the row sideways."
            onPick={() => undefined}
          />
        </Specimen>
        <Specimen name="Destination list (Add, Give, Move): the primary top right on a tablet, the bottom bar on a phone">
          <div className="gallery__sheet-head">
            <span className="label">Where it goes</span>
            <div className="top-action">{addTo}</div>
          </div>
          <DestinationList label="Where it goes" destinations={destinations} selected={picked} onSelect={setPicked} onBlocked={setReason} />
          <div className="bottom-action">
            <ActionBar>{addTo}</ActionBar>
          </div>
        </Specimen>
      </Section>

      <Section id="organisms" title="Organisms">
        <Specimen name="Pinned note (a working panel; stays until the character is resent)">
          <PinnedNote from="Priya (GM)">Your HP is above the dice. Roll 1d6 again and enter what you rolled.</PinnedNote>
        </Specimen>
        <Specimen name="Review screen: sent back, a flagged section, an override and broken rules (the action top right on a tablet)">
          {review()}
        </Specimen>
        <Specimen name="Review screen, phone version: the action in the sticky bottom bar">
          <div className="gallery__phone-frame">{review('phone')}</div>
        </Specimen>
        <Specimen name="Rules for this campaign: topic groups with count lines, source tags, rows that don't fit as a list">
          <RulesForThisCampaign groups={groups} onChange={setRule} open={rulesOpen} onOpen={setRulesOpen} />
        </Specimen>
      </Section>

      <Section id="states" title="States every view covers">
        <Specimen name="Empty">
          <p className="gallery__empty">Nothing carved here yet. Add your first character.</p>
          <button type="button" className="button-secondary">
            Make a character
          </button>
        </Specimen>
        <Specimen name="Loading (skeleton rows)">
          <SkeletonRows rows={3} label="Loading the pack" />
        </Specimen>
        <Specimen name="Partial: one item">
          <p className="gallery__line">Torch ×1</p>
        </Specimen>
        <Specimen name="Overflow: long names, 0 and 999">
          <p className="gallery__line">Wren of the Lantern Wardens and the Long Night Ferry, 0 gp, Arrows ×999</p> {/* words: names */}
        </Specimen>
        <Specimen name="Error">
          <Note tone="danger">Couldn't save the change. Check the connection and try again.</Note>
        </Specimen>
        <Specimen name="Offline placeholder">
          <Note tone="info">Pictures need a connection. They open when you're back online.</Note>
        </Specimen>
      </Section>

      {/* Last, so the sections above keep their place (their approved pictures are measured where they stand). */}
      <Section id="wilderness" title="Wilderness">
        <WildernessSpecimens Specimen={Specimen} />
      </Section>

      {/* After Wilderness, so the sections above keep their approved pictures (sheet plan order 5, sr-9). */}
      <Section id="pack-load" title="Pack load">
        <PackLoadSpecimens Specimen={Specimen} />
      </Section>

      {/* After Wilderness, so the sections above keep their approved pictures. */}
      <Section id="sheet-magic" title="Full sheet: Magic">
        <Specimen name="Magic (sr-4): spells a day as pips per level, a tab per kind of magic, a given spell tagged, a very long name">
          <MagicBlock magic={GALLERY_MAGIC} onOpen={(row) => setToast(`Opened ${row.name}`)} />
        </Specimen>
        <Specimen name="Magic, a caster with no spells picked yet">
          <MagicBlock magic={GALLERY_MAGIC_EMPTY} onOpen={() => {}} />
        </Specimen>
        <Specimen name="Magic, six spell levels with level 4 at none (left out): the levels wrap, nothing clipped">
          <MagicBlock magic={GALLERY_MAGIC_LEVELS} onOpen={() => {}} />
        </Specimen>
        <Specimen name="Magic, five kinds: past two rows at full size the tabs take the small size">
          <MagicBlock magic={GALLERY_MAGIC_KINDS} onOpen={() => {}} />
        </Specimen>
        <Specimen name="Magic, a list of 11 folds after 8">
          <MagicBlock magic={GALLERY_MAGIC_LONG} onOpen={() => {}} />
        </Specimen>
        <Specimen name="Magic, a caster who prays, nothing prepared">
          <MagicBlock magic={GALLERY_MAGIC_PRAYS} onOpen={() => {}} />
        </Specimen>
      </Section>
      {/* After the rest, so the sections above keep their approved pictures (M8b slice 0, pull request 2). */}
      <Section id="places" title="Places from packs">
        <PlacesSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (m8b-0 delivery 5). */}
      <Section id="end-safety" title="End of an expedition">
        <EndSafetySpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (the creation rework, cw-11, slice A1). */}
      <Section id="creation-shell" title="Creation: the shell, the typed stepper, the fold">
        <CreationShellSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (the creation rework, cw-11, slice D). */}
      <Section id="creation-review" title="Creation: the review">
        <BookType>
          <CreationReviewSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (the creation rework, cw-11, slice B). */}
      <Section id="creation-who" title="Creation: Who they are and Details">
        <BookType>
          <CreationWhoSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (the creation rework, cw-11, slice C). */}
      <Section id="creation-gear" title="Creation: Gear, the kit's Roll sequence">
        <BookType>
          <CreationGearSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (creation's final drafts, slice A); no pictures yet. */}
      <Section id="creation-final" title="Creation: the final drafts' pieces">
        <BookType>
          <CreationFinalSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* After the slice A section, so its pictures stay; slices D and F's parts and states, no pictures yet. */}
      <Section id="creation-final-d" title="Creation: the final drafts D and F">
        <BookType>
          <CreationFinalDSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (slice E, the phone's navigation); no pictures yet. */}
      <Section id="phone-navigation" title="The phone's navigation: the tab bar and the drawer">
        <PhoneNavSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (the players' screens on the standard, A and B); no pictures yet. */}
      <Section id="players-standard" title="The players' screens: status rings, rows, save tiles, the breakdown sheet">
        <PlayersStandardSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their place (plan m5b-players-screens-standard C). */}
      <Section id="pack-standard" title="The Pack on creation's standard">
        <PackStandardSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (the full sheet on the standard, D); no pictures yet. */}
      <Section id="full-sheet-standard" title="The full sheet: score tiles, fold rows, the Level row, the foot">
        <FullSheetSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (the full sheet revised, 2026-11-08); no pictures yet. */}
      <Section id="sheet-revised" title="The full sheet revised: Sheet rows, language boxes, the details ledger, sheet changes, notes">
        <SheetRevisedSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (the GM's tabs with something to act on); no pictures yet. */}
      <Section id="gm-attention" title="The GM's tabs: something to act on (lit, unlit, reduced motion)">
        <GmAttentionSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (ruling m5b-at-hand-actions-2026-11-08); no pictures yet. */}
      <Section id="at-hand-actions" title="At hand: Wield, Attack, weapon modes">
        <AtHandSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (m5b-long-tables, 2026-11-09); no pictures yet. */}
      <Section id="creation-long-tables" title="Creation: long tables in their sheet">
        <BookType>
          <CreationLongTablesSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (December 1a, the #636 rework); new pictures for Design. */}
      <Section id="patron" title="The patron: its creation step and the sheet's section">
        <PatronSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (pf-16, the takes mark, 2026-11-13); a new picture for Design. */}
      <Section id="creation-trait-list" title="Creation: a trait list rolled more than once">
        <BookType>
          <TraitListSpecimens Specimen={Specimen} />
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (plan dec-1-creation 1d, sn-1). */}
      <Section id="same-name-source" title="Same-named entries: the pack after the name">
        <SameNameSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-7 piece 1, 2026-11-12); new pictures for Design. */}
      <Section id="standard-parts" title="The standard parts: the toggle, the eye, dice in words">
        <StandardPartsSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-7 piece 5a, 2026-11-13); new pictures for Design. */}
      <Section id="map-parts" title="The map: its card and its pop-up">
        <MapPartsSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-7 piece 4a, 2026-11-13); new pictures for Design. */}
      <Section id="move-on-parts" title="Moving on: where to, the obstacle, one sheet">
        <MoveOnSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-10 E, 2026-11-14); new pictures for Design. */}
      <Section id="tapped-tables" title="Creation: the book's tapped table">
        <TappedTableSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-10 F-b, 2026-11-14); new pictures for Design. */}
      <Section id="stock-rows" title="The shop's stock rows">
        <StockRowSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-10 G and H, 2026-11-14); new pictures for Design. */}
      <Section id="patron-first" title="Creation: Pick a patron first">
        <BookType>
          <Specimen name="Next on the Patron step with none picked (cs-50, 23-H5): one sentence, the two ways out, no X">
            <PatronFirstDialog className="Marsh Chaplain" classStep="Class" onBack={() => undefined} onChoose={() => undefined} preview /> {/* words: names */}
          </Specimen>
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (December 5c, the stat block); new pictures. */}
      <Section id="stat-block" title="The stat block: View, the Rules browser, the waiting card's stat lines, messy data">
        <StatBlockSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (stk-1, st-6: the shared stacked button); new pictures. */}
      <Section id="stacked-button" title="The stacked button: the icon above its word, secondary and primary">
        <StackedButtonSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (the lead's ruling, pq-1 sizes, 2026-11-14); new pictures. */}
      <Section id="book-list-rows" title="The List row in the book's type">
        <BookType>
          <Specimen name="A plain row's title at 20 px (a long one wraps), a figure row's name and a label row's label at 16">
            <RowList label="List rows in the book's type">
              <ListRow title="Lantern ward" sub="Once a day, a light no wind puts out" onOpen={() => undefined} />
              <ListRow title="A very long ability name that runs on past one line at twenty pixels" value="87 %" onOpen={() => undefined} />
              <ListRow figure chevron={false} title="Bog sense" value="3-in-6" onOpen={() => undefined} />
              <ListRow label title="Set by" sub="The GM, day 2" />
            </RowList>
          </Specimen>
        </BookType>
      </Section>

      {/* Last, so the sections above keep their approved pictures (ft-1, 2026-11-14: a sheet's foot); new pictures. */}
      <Section id="sheet-foot" title="A sheet's foot (ft-1): buttons at the right in code order; stacked only when they don't fit a row">
        <SheetFootSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-8 piece D, 2026-11-14); new pictures for Design. */}
      <Section id="night-rest" title="A night's rest: the GM's rest prompt">
        <NightRestSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (lv-1, pf-22: a spell level's words); new pictures for the lead. */}
      <Section id="level-names" title="A spell level's words: the list's own, else Level 0">
        <LevelNameSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-7 piece 6a, 2026-11-14); new pictures for Design. */}
      <Section id="knowledge" title="A place’s Knowledge: the facts and the folded sections">
        <KnowledgeSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-9-the-whole-scene S10; page 16, T6); new pictures for the lead. */}
      <Section id="weather-sheet" title="The Weather sheet: the GM's table to tap, a player's number">
        <WeatherSheetSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their approved pictures (plan dec-8 piece C, #925); new pictures for Design. */}
      <Section id="prepare" title="Prepare: choosing spells for the next rest, and the List row's Stepper row">
        <PrepareSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-13 C11): the Player screen's state lines; new pictures. */}
      <Section id="player-states" title="The Player screen's states: opening, couldn't open, offline">
        <PlayerStatesSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-9-the-players-scene P4): new pictures for Francis. */}
      <Section id="players-place-card" title="The players' place card: the Location, the Area, the GM's eyes on Knowledge">
        <PlayersPlaceCardSpecimens Specimen={Specimen} />
      </Section>

      {/* Last, so the sections above keep their pictures (plan dec-9-the-players-scene P7; page 40, approved 2026-11-24):
          new pictures for Francis (phone and dark approved from them, p7-8). */}
      <Section id="call-card" title="The call card: a call or a rumour reaching a player, folded after Got it">
        <CallCardSpecimens Specimen={Specimen} />
      </Section>

      {reason && (
        <Dialog label="Not allowed" onClose={() => setReason(null)}>
          <p>{reason}</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setReason(null)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}
      {dialog && (
        <Dialog label="End the expedition?" onClose={() => setDialog(false)}>
          <p>Time stops, lights go out, and the party comes home.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setDialog(false)}>
              End it
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setDialog(false)}>
              Not now
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
