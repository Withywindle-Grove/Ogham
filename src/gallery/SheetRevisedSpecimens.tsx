// The full sheet revised (plan m5b-sheet-revised, mockup players/05 approved 2026-11-08) for the gallery: the Sheet
// rows (Skills, Abilities with the experience bonus, Traits; a long name, 0 and 999, a word figure), the language
// boxes with the literacy line, the details ledger (look A, the backstory's drop capital; nothing written), the sheet
// change lines (waiting with Take back; refused with the GM's reason), the GM's sheet change card, the Notes sheet,
// and the HP box past 20 segments (the continuous bar). Invented names only. No pictures yet: CI draws them and they
// go to Design.
import type { ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { hpLine } from '../modules/characters/hp.ts';
import { hpSegments } from '../modules/characters/play.ts';
import type { SheetChange } from '../modules/characters/sheetChanges.ts';
import { HpBox } from '../ui/HpBox.tsx';
import { ListRow, RowList } from '../ui/parts.tsx';
import { DieGlyph } from '../ui/dice.tsx';
import { SheetChangeCard } from '../app/SheetChangeCards.tsx';
import { DetailsLedger, LanguageBoxes, NotesSheet, SheetChangeLines } from '../app/SheetParts.tsx';
import '../app/CharacterSheet.css';
import '../app/GmCampaign.css';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactNode;

const none = () => undefined;
const today = new Date().toISOString();
const change = (over: Partial<SheetChange>): SheetChange => ({
  id: 'change-1',
  campaignId: 'campaign-gallery',
  actorId: 'actor-wren',
  requesterId: 'user-gallery',
  field: 'MUS',
  label: 'Muscle',
  from: 16,
  to: 17,
  status: 'waiting',
  reason: '',
  answeredAt: null,
  createdAt: today,
  version: 1,
  ...over,
});
// The card only reaches the database on a tap; the gallery never taps it.
const noDb = {} as Db;
const gm: CurrentUser = { id: 'user-gm', roles: { 'campaign-gallery': 'gm' } };

export function SheetRevisedSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Sheet rows: Skills, the name left, the die's glyph and the figure at the right, a chevron, a dotted rule (ch-1)">
        <div className="gallery__col">
          <RowList dotted>
            <ListRow figure title="Listen at doors" valueLead={<DieGlyph die={6} size={16} />} value="1-in-6" onOpen={none} />
            <ListRow figure title="Find the hidden ways through the drowned abbey's lower cellars" valueLead={<DieGlyph die={6} size={16} />} value="2-in-6" onOpen={none} />
            <ListRow figure title="Forage" sub="kindred" valueLead={<DieGlyph die={6} size={16} />} value="3-in-6" onOpen={none} />
            <ListRow figure title="Slip through reeds" valueLead={<DieGlyph die={100} size={16} />} value="99%" onOpen={none} />
            <ListRow figure title="Read the tides" value="Often" onOpen={none} />
          </RowList>
        </div>
      </Specimen>
      <Specimen name="Sheet rows: Abilities with the experience bonus and a word figure; Traits with the alignment; 0 and 999; a chevron where a row opens">
        <div className="gallery__col">
          <RowList dotted>
            <ListRow figure title="Bane of eels" value="Eels" onOpen={none} />
            <ListRow figure title="Experience bonus" value="+10 %" onOpen={none} />
            <ListRow figure title="Lantern ward" value="1 use a day" onOpen={none} />
          </RowList>
          <RowList dotted>
            <ListRow figure title="Moon sight" value="999 ft" onOpen={none} />
            <ListRow figure title="Iron-shy" value="0" onOpen={none} />
            <ListRow figure title="Alignment" value="Lantern" />
          </RowList>
        </div>
      </Specimen>
      <Specimen name="Language boxes, a long name and one the pack doesn't list; the literacy line">
        <div className="gallery__col">
          <LanguageBoxes
            languages={[
              { key: 'fen', name: 'Fen common', onOpen: none },
              { key: 'heron', name: 'Heron-tongue', onOpen: none },
              { key: 'long', name: 'The whispered cant of the reed-cutters of the lower marsh', onOpen: none },
              { key: 'typed', name: 'Gull-speech' },
            ]}
          />
          <p className="auth__meta">Literacy: Literate, reads and writes the languages above.</p>
        </div>
      </Specimen>
      <Specimen name="Details and backstory (look A): muted labels, Garamond values, the drop capital; nothing written">
        <div className="gallery__col">
          <DetailsLedger
            rows={[
              { key: 'scars', label: 'Scars and marks', value: 'A heron-shaped burn across the left hand' },
              { key: 'wants', label: 'Wants', value: 'A boat of their own' },
              { key: 'manner', label: 'Manner', value: 'Quiet' },
            ]}
            story="Wren came down the river after the long flood, when the lanterns of Reedmouth went dark one by one. She carries her mother's lamp and a debt she does not speak of."
          />
          <DetailsLedger rows={[]} story="" />
        </div>
      </Specimen>
      <Specimen name="Sheet change lines: waiting for the GM with Take back; refused with the GM's reason and OK">
        <div className="gallery__col gallery__col--full">
          <SheetChangeLines changes={[change({}), change({ id: 'change-2', field: 'hpMax', label: 'Max HP', from: 8, to: 9999, status: 'refused', reason: 'Not after one night at the inn.' })]} onTakeBack={none} onDismiss={none} />
        </div>
      </Specimen>
      <Specimen name="The GM's sheet change card: who asks, what, Approve and Refuse">
        <div className="gallery__col gallery__col--full">
          <SheetChangeCard db={noDb} user={gm} waiting={{ change: change({}), character: 'Wren of the long name that runs on past the edge', player: 'Priya' }} onAnswered={none} />
        </div>
      </Specimen>
      <Specimen name="The Notes sheet: newest first, when and who, then a field and Add">
        <NotesSheet
          preview
          notes={[
            { id: 'n1', when: 'today', who: 'by you', text: 'Owe Bram 20 coins for the lamp oil.' },
            { id: 'n2', when: 'yesterday', who: 'by you', text: 'The ferryman knew my mother’s name.' },
            { id: 'n3', when: '3 Nov', who: 'from your GM', text: 'Your lamp hums near running water.' },
          ]}
          onAdd={async () => true}
          onClose={none}
        />
      </Specimen>
      <Specimen name="The HP box past 20 segments: one continuous bar (a most of 999)">
        <div className="gallery__col">
          {(
            [
              [640, 999],
              [999, 999],
            ] as const
          ).map(([hp, max]) => (
            <HpBox key={hp} hp={hp} max={max} fills={hpSegments(hp, max).fills} figureLabel={`Hit points ${hpLine(hp, max)}. Type a value`} onFigure={none} onStep={none} />
          ))}
        </div>
      </Specimen>
    </>
  );
}
