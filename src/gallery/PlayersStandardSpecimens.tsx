// The players' screens on creation's standard, slices A and B (plan m5b-players-screens-standard; mockup
// players/01-player-pack-sheet-standard) for the gallery: status rings (players/02, plan m5b-creation-retest-3 F), list
// rows (with their own action, opening with a chevron, with a value, a long name, none left), the Save tiles (five,
// and a long name), the breakdown sheet (a save, with The rule and the source), and ⋯ as a Sheet. Invented
// names only. No pictures yet: CI draws them and they go to Design.
import type { ReactNode } from 'react';
import { SkillRollLine } from '../app/FigureSheets.tsx';
import { LightSection, type CharacterLightView } from '../app/LightSection.tsx';
import type { CharacterLight } from '../modules/expedition/lightPlay.ts';
import { BreakdownSheet } from '../ui/BreakdownSheet.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { MenuItem, MenuItems } from '../ui/MoreMenu.tsx';
import { ListRow, RowList, SaveRow } from '../ui/parts.tsx';
import { HpBox } from '../ui/HpBox.tsx';
import { hpLine } from '../modules/characters/hp.ts';
import { hpSegments } from '../modules/characters/play.ts';
import { StatusRing, StatusRingMark, StatusRingRow } from '../ui/StatusRing.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactNode;

const none = () => undefined;
const nothing = async () => undefined;

// The Player screen's Light section (the ring as its glyph, Francis's option B on #560): a light an hour long that
// warns at its last 10 minutes, on a clock standing at 3,600 s; a turn is 10 minutes.
const NOW = 3600;
const TURN = { name: 'turn', seconds: 600 };
const lantern = (name: string, litAt: number, burnSeconds: number | null): CharacterLight => ({
  id: `light-${name}`,
  actorId: 'wren',
  campaignId: 'gallery',
  lineId: `line-${name}`,
  typeId: 'lantern',
  name,
  litAt,
  burnSeconds,
  fullSeconds: burnSeconds,
  warnSeconds: burnSeconds === null ? null : 600,
  leftSeconds: null,
  consumed: false,
  fuelItem: null,
  keepLit: false,
  outAt: null,
  version: 1,
});
const lightView = (light: CharacterLight, fuelLeft = 0): CharacterLightView => ({
  light,
  now: NOW,
  options: [],
  lines: [],
  units: { turn: TURN.seconds },
  fuel: { left: fuelLeft, name: fuelLeft > 0 ? 'Lamp oil' : null },
  unitOf: () => TURN,
  lightIt: nothing,
  lightAnother: nothing,
  douse: nothing,
  keepLit: nothing,
  refill: nothing,
  refillAndLight: nothing,
  reload: none,
});
/**
 * Lit just now (the full ring; a holder with 3 refills and Keep lit on, as frame P1 draws it), at its last sixth (the
 * warning sign), and a light that never runs out (dashed).
 */
export const LIGHT_SPECIMENS: readonly CharacterLightView[] = [
  lightView({ ...lantern('Storm lantern', NOW, 3600), fuelItem: 'lamp-oil', keepLit: true }, 3),
  lightView(lantern('Rushlight', 600, 3600)),
  lightView(lantern('Glow-moss jar', 0, null)),
];
/** The HP box's states (mockup players/04): full, hurt, at 0, a big figure (96 of 99: a 999 most would run the bar off the screen, a known HpBar limit), over the most, no most recorded, none set yet. */
export const HP_SPECIMENS: readonly (readonly [number | null, number | null])[] = [
  [8, 8],
  [5, 8],
  [0, 8],
  [96, 99],
  [17, 14],
  [6, null],
  [null, null],
];
const SAVES = [
  { key: 'mire', short: 'Mire', name: 'Save vs mire', value: '12' },
  { key: 'ward', short: 'Ward', name: 'Save vs wards', value: '13' },
  { key: 'stone', short: 'Stone', name: 'Save vs stone', value: '14' },
  { key: 'gust', short: 'Gust', name: 'Save vs gusts', value: '15' },
  { key: 'hex', short: 'Hex', name: 'Save vs hexes', value: '16' },
];

export function PlayersStandardSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Status rings: tones, a long name, 0 left, 999, no end, an unknown icon, a hidden time; the sheet's big ring">
        <div className="gallery__col">
          <StatusRingRow>
            <StatusRing name="Torch-lit" icon="flame" tone="light" fraction={4 / 6} words="4 turns" label="Torch-lit, 4 turns left. Details" onOpen={none} />
            <StatusRing name="Blessed" icon="star" tone="boon" fraction={1 / 6} words="1 turn" label="Blessed, 1 turn left. Details" onOpen={none} />
            <StatusRing name="Poisoned" icon="drop" tone="harm" fraction={2 / 3} words="2 days" label="Poisoned, 2 days left. Details" onOpen={none} />
            <StatusRing name="Soaked to the bone by the long causeway's rain" icon="snowflake" tone="harm" fraction={3 / 4} words="12 turns" label="Soaked to the bone by the long causeway's rain, 12 turns left. Details" onOpen={none} />
            <StatusRing name="Reed ward" icon="shield" tone="boon" fraction={0} words="ran out" label="Reed ward, ran out. Details" onOpen={none} />
            <StatusRing name="Fen-sight" icon="eye-half" tone="neutral" fraction={1} words="999 turns" label="Fen-sight, 999 turns left. Details" onOpen={none} />
            <StatusRing name="Down" icon="bed" tone="harm" fraction={null} endless words="until removed" label="Down, until removed. Details" onOpen={none} />
            <StatusRing name="Muddy boots" icon="no-such-symbol" fraction={1 / 2} words="3 turns" label="Muddy boots, 3 turns left. Details" onOpen={none} />
            <StatusRing name="Marked" icon="lock" tone="harm" fraction={null} words="time hidden" label="Marked, active. Details" onOpen={none} />
            <StatusRing name="Can't cast" fraction={null} endless words="while worn" label="Can't cast, while worn. Details" onOpen={none} />
          </StatusRingRow>
          <div className="gallery__row">
            <StatusRingMark name="Torch-lit" icon="flame" tone="light" fraction={4 / 6} big />
            <StatusRingMark name="Weary" fraction={null} endless big />
          </div>
        </div>
      </Specimen>
      <Specimen name="The Player screen's Light: the ring as its glyph, full; at its last sixth with the warning sign; a light that never runs out, dashed">
        <div className="gallery__col">
          {LIGHT_SPECIMENS.map((view) => (
            <LightSection key={(view.light as CharacterLight).id} view={view} />
          ))}
        </div>
      </Specimen>
      <Specimen name="Hit points in place (alternative C): the figure at the left, − and + at the right; full, hurt, 0, 96 of 99, over max, no most, none set">
        <div className="gallery__col">
          {HP_SPECIMENS.map(([hp, max], i) => (
            <HpBox key={i} hp={hp} max={max} fills={hpSegments(hp, max).fills} figureLabel={hp === null ? 'Hit points not set yet. Type them' : `Hit points ${hpLine(hp, max)}. Type a value`} onFigure={none} onStep={none} />
          ))}
        </div>
      </Specimen>
      <Specimen name="List rows: Traits with Use (one left, none left), Skills with their values and a chevron, a long name">
        <div className="gallery__col">
          <RowList>
            <ListRow title="Steady flame" sub="1 of 1 left, back each day" onOpen={none} action="Use" actionLabel="Use Steady flame" onAction={none} />
            <ListRow title="Ember ward" sub="None of 2 left, back each day" onOpen={none} action="Use" actionLabel="Use Ember ward" onAction={none} />
            <ListRow title="The long patient listening of the reed-cutters at the edge of the drowned bells" sub="0 of 999 left" onOpen={none} action="Use" actionLabel="Use the long patient listening" onAction={none} />
          </RowList>
          <RowList>
            <ListRow title="Hark" value="6+" onOpen={none} />
            <ListRow title="Slip through reeds" value="2-in-6" onOpen={none} />
            <ListRow title="Read the water where the old causeway sank below the marsh" value="87 %" onOpen={none} />
          </RowList>
        </div>
      </Specimen>
      <Specimen name="Save tiles: five across, the pack's short names; a long one wraps between words (never …, never inside a word), the row taking three and two when a word won't fit, one height per row">
        <div className="gallery__col">
          <SaveRow saves={SAVES} onOpen={none} />
          <SaveRow saves={[...SAVES.slice(0, 4), { key: 'long', short: 'Breath of the drowned', name: "Save against the bog lurker's mire breath", value: '999' }]} onOpen={none} />
        </div>
      </Specimen>
      <Specimen name="The breakdown sheet: a save's number in the head (the Figure head), its roll line, the rule's words on the sheet itself (no heading, no second sheet), the source; nothing changes it, so no Modifiers">
        <BreakdownSheet
          preview
          title="Save vs mire"
          figure="12"
          figureHead
          roll={{ die: 20, words: 'Roll d20: 12 or higher succeeds.' }}
          rule={['Equal or higher: the mire lets go, or does half its harm.', 'Lower: the mire takes hold in full.']}
          source="Fen sample"
          onClose={none}
        />
      </Specimen>
      <Specimen name="The breakdown sheet: a save that a score and the kindred change, with Modifiers; a long name wraps beside the number">
        <BreakdownSheet
          preview
          title="Save against the bog lurker's drowning hexes"
          figure="999"
          figureHead
          modifiers={['Spell ward: +1 from Wit.', 'Spell ward: +2 from Bog folk.', 'Vs mire: +1 from Bog folk.']}
          rule={['Roll d20 at the table; meet or beat the number and you are spared the worst of it.']}
          source="Fen sample"
          onClose={none}
        />
      </Specimen>
      <Specimen name="The breakdown sheet: a skill's one top line, what succeeds and what to roll (tfs-1: nothing on where the number comes from), then the setting's words and the source">
        <BreakdownSheet preview title="Slip through reeds" figure={<SkillRollLine roll={{ target: 5, sides: 6 }} />} lines={['Slip between the stems without a sound, where the water is no deeper than a knee.']} source="Fen sample" onClose={none} />
      </Specimen>
      <Specimen name="The breakdown sheet: a skill with a long name, its top line wrapping with the glyph kept beside its words; a skill rolled by percentage keeps its old top line (⚑ 13)">
        <div className="gallery__col">
          <BreakdownSheet preview title="Finding the way through fen and reed-bed by night" figure={<SkillRollLine roll={{ target: 6, sides: 20 }} />} ending="Your setting doesn't describe what this skill does. Ask your GM how it works at your table." source="Fen sample" onClose={none} />
          <BreakdownSheet preview title="Pick a lock" figure="Succeeds on 35 or less on d100, 35 in 100" lines={['Open a lock with picks, in quiet.']} source="Fen sample" onClose={none} />
        </div>
      </Specimen>
      <Specimen name="⋯ as a Sheet: the screen's own options, then the app's menu below a divider">
        <Dialog label="More" onClose={none} preview>
          <div className="more-sheet">
            <MenuItems>
              <MenuItem icon="company" onClick={none}>
                Company
              </MenuItem>
            </MenuItems>
            <MenuItems>
              <MenuItem icon="characters" onClick={none}>
                Your characters
              </MenuItem>
              <MenuItem icon="scales" onClick={none}>
                Setting rules
              </MenuItem>
            </MenuItems>
          </div>
        </Dialog>
      </Specimen>
    </>
  );
}
