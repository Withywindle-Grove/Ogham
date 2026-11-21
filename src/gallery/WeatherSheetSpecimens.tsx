// The Weather sheet in the component gallery (S10; st-3, wr-1; page 16, T6), drawn in the page, with messy data: an
// eight-row weather table and a long weather line. Invented weather only. Two specimens: the GM's sheet with the
// weather already rolled (today's weather in plain words, who entered it, then the table to change it, its row
// ticked), and a player's sheet when the players roll it (the number box and Enter; the table is never drawn). No
// database is touched while drawing; a tap here would reach none (`db` is a stand-in).
import type { ReactElement, ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { WeatherNow } from '../modules/expedition/procedure.ts';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import type { WeatherRoll } from '../modules/expedition/weatherPlay.ts';
import type { WeatherView } from '../app/WeatherCard.tsx';
import { WeatherSheet } from '../app/WeatherSheet.tsx';

const LONG = 'A grey, drowning rain that comes sideways off the lantern coast and does not stop until the tide turns';
const MARSH: ReadTable = readTable('marsh-spring', 'Marsh weather, spring', {
  die: 'd8',
  rows: [
    { roll: '1', result: 'Fair' },
    { roll: '2', result: 'Mist on the water' },
    { roll: '3', result: 'Drizzle' },
    { roll: '4', result: 'Low cloud' },
    { roll: '5', result: LONG },
    { roll: '6', result: 'Hard rain' },
    { roll: '7', result: 'Fog' },
    { roll: '8', result: 'Gale' },
  ],
})!;
const TABLES = new Map([[MARSH.id, MARSH]]);

const GM: CurrentUser = { id: 'gm', roles: { c: 'gm' } };
const PLAYER: CurrentUser = { id: 'sam', roles: { c: 'player' } };
const NOW: WeatherNow = { period: 0, startsAt: 0, endsAt: 86400, tableId: MARSH.id, tableChoices: [], season: 'spring', waitingForSeason: false, tags: {} };
const ROLLED = { id: 'w', tableId: MARSH.id, roll: '5', result: LONG, tags: ['wet', 'mired'], version: 1 } as unknown as WeatherRoll;
const base = { campaignId: 'c', expeditionId: 'x', now: NOW, rolledBy: 'players' as const, die: 'd8', enteredBy: null, enteredByGm: false, changedBy: null };
const IN: WeatherView = {
  kind: 'in',
  ...base,
  rolledBy: 'gm',
  weather: ROLLED,
  lines: ['Wet, Lighting a campfire is hard, and damp tinder smokes for a long while before it takes', 'Mired, −2 travel points'],
  parts: [
    { label: 'Wet', words: ['Lighting a campfire is hard, and damp tinder smokes for a long while before it takes'] },
    { label: 'Mired', words: ['−2 travel points'] },
  ],
  enteredBy: 'Priya',
  enteredByGm: true,
};
const DUE: WeatherView = { kind: 'due', ...base, weather: null, lines: [], parts: [] };

const NO_DB = null as unknown as Db;
const nothing = () => {};

export function WeatherSheetSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="The Weather sheet, the GM's, the weather rolled: today's weather in plain words, who rolled it (Rolled by the GM.), then the eight-row table to change it, its row ticked">
        <WeatherSheet db={NO_DB} user={GM} view={IN} tables={TABLES} over="14 Reedmonth, spring" onChanged={nothing} onClose={nothing} preview />
      </Specimen>
      <Specimen name="The Weather sheet, a player's when the players roll it: the number box and Enter, its one accent; the table never drawn">
        <WeatherSheet db={NO_DB} user={PLAYER} view={DUE} over="14 Reedmonth, spring" onChanged={nothing} onClose={nothing} preview />
      </Specimen>
    </>
  );
}
