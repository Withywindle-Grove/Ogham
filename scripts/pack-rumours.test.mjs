// pack:check on a table of rumours (dec-12 piece E; hard rule 5): one opened to players ("gmOnly": false) is named,
// since the app won't import it; one left to the GM is fine. And (the E follow-up, after the rm-3 findings) a weather
// table that is a table of rumours is an error. Invented snippets.
import { describe, expect, it } from 'vitest';
import { formatNotes, rumourWeatherErrors, rumourWeatherLibraryErrors } from './pack-format.mjs';

const pack = (table) => ({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'The eel weirs', version: '0.1', kind: 'adventure' }, tables: [table] });
const rows = [{ min: 1, max: 1, result: 'The cog went down with her captain still aboard.', truth: 'true' }];
const opened = 'tables: "ew-quay": a table of rumours marked "gmOnly": false would show players whether each rumour is true, so the app won\'t import it. Take "gmOnly": false off: a rumour reaches players when the GM gives it.';

describe('pack:check on a table of rumours', () => {
  // Purpose: a rumours table opened to players is named, by its use or by the older kind.
  it('names a table of rumours marked "gmOnly": false', () => {
    expect(formatNotes(pack({ id: 'ew-quay', name: 'Quay rumours', die: 'd4', uses: ['world.rumours'], gmOnly: false, rows }))).toContain(opened);
    expect(formatNotes(pack({ id: 'ew-quay', name: 'Quay rumours', die: 'd4', kind: 'rumours', gmOnly: false, rows }))).toContain(opened);
  });

  // Purpose: a rumours table left to the GM, and another table opened to players, are not named.
  it('says nothing of a rumours table left to the GM, or of another open table', () => {
    expect(formatNotes(pack({ id: 'ew-quay', name: 'Quay rumours', die: 'd4', uses: ['world.rumours'], rows }))).not.toContain(opened);
    const other = formatNotes(pack({ id: 'ew-names', name: 'Quay rumours', die: 'd4', uses: ['people.names'], gmOnly: false, rows }));
    expect(other.some((note) => note.includes('table of rumours'))).toBe(false);
  });
});

describe('pack:check on a weather table that is a table of rumours (the rm-3 findings)', () => {
  const quay = { id: 'ew-quay', name: 'Quay rumours', die: 'd4', uses: ['world.rumours'], rows };
  const fog = { id: 'ew-fog', name: 'Fen weather', die: 'd6', uses: ['world.weather'], rows: [{ min: 1, max: 6, result: 'Fog' }] };
  const withRules = (rulesSet) => ({ ...pack(quay), tables: [quay, fog], rulesSets: [{ id: 'fen-rules', name: 'Fen rules', ...rulesSet }] });
  const error = 'rulesSets: "fen-rules" names "ew-quay" as a weather table, but it is a table of rumours: a player rolling the weather would read its rumours. Name a weather table instead.';

  // Purpose: a rumours table named as a weather table, in each place a rules set names one, is an error.
  it('is an error wherever a rules set names it as a weather table', () => {
    expect(rumourWeatherErrors(withRules({ weather: { tables: { spring: 'ew-quay' } } }))).toEqual([error]);
    expect(rumourWeatherErrors(withRules({ exploration: { modes: [{ id: 'wild', weather: { tables: { any: 'ew-quay' } } }] } }))).toEqual([error]);
    expect(rumourWeatherErrors(withRules({ exploration: { modes: [{ id: 'wild', procedure: [{ icon: 'weather', tableId: 'ew-quay' }] }] } }))).toEqual([error]);
    expect(rumourWeatherErrors(withRules({ exploration: { modes: [{ id: 'wild', procedure: [{ icon: 'weather', tableBySeason: { winter: 'ew-quay' } }] }] } }))).toEqual([error]);
    expect(rumourWeatherErrors(withRules({ specialSeasons: [{ id: 'hitching', weatherTableId: 'ew-quay' }] }))).toEqual([error]);
    expect(rumourWeatherErrors(withRules({ byOption: { 'fen-weather=on': { weather: { tables: { spring: 'ew-quay' } } } } }))).toEqual([error]);
  });

  // Purpose: a weather table that isn't a table of rumours is fine.
  it('says nothing of an ordinary weather table', () => {
    expect(rumourWeatherErrors(withRules({ weather: { tables: { spring: 'ew-fog' } } }))).toEqual([]);
  });

  // Purpose: a table is a table of rumours by its `use` even when it also has `uses`: both are read, as the database
  // reads them (the review of #835).
  it('reads `use` as well as `uses`', () => {
    const both = { ...quay, uses: ['encounters'], use: 'world.rumours' };
    const file = { ...pack(both), tables: [both, fog], rulesSets: [{ id: 'fen-rules', name: 'Fen rules', weather: { tables: { spring: 'ew-quay' } } }] };
    expect(rumourWeatherErrors(file)).toEqual([error]);
    expect(formatNotes(pack({ ...both, gmOnly: false }))).toContain(opened);
  });

  // Purpose: a pack read from Markdown (no JSON) is passed over, never a crash.
  it('passes over a pack with no JSON', () => {
    expect(rumourWeatherErrors(null)).toEqual([]);
    expect(rumourWeatherLibraryErrors([null, withRules({ weather: { tables: { spring: 'ew-quay' } } })])).toEqual([]);
  });
});

describe('pack:check across packs given together (the review of #835)', () => {
  const setting = {
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { name: 'Fen setting', version: '0.1' },
    tables: [{ id: 'ew-fog', name: 'Fen weather', die: 'd6', uses: ['world.weather'], rows: [{ min: 1, max: 6, result: 'Fog' }] }],
    rulesSets: [{ id: 'fen-rules', name: 'Fen rules', weather: { tables: { spring: 'ew-quay' } } }],
  };
  const adventure = pack({ id: 'ew-quay', name: 'Quay rumours', die: 'd4', uses: ['world.rumours'], rows });

  // Purpose: a setting's weather table that is another pack's table of rumours is an error when the two are checked
  // together (the database looks the table up in every attached pack), and neither file shows it alone.
  it("is an error when a setting's weather table is an adventure's table of rumours", () => {
    expect(rumourWeatherErrors(setting)).toEqual([]);
    expect(rumourWeatherErrors(adventure)).toEqual([]);
    expect(rumourWeatherLibraryErrors([setting, adventure])).toEqual([
      'rulesSets: "fen-rules" names "ew-quay" as a weather table, but The eel weirs has it as a table of rumours: a player rolling the weather would read its rumours. Name a weather table instead.',
    ]);
  });

  // Purpose: what one file shows alone isn't said again for the packs together.
  it("doesn't repeat what a file shows alone", () => {
    const alone = { ...adventure, rulesSets: [{ id: 'quay-rules', name: 'Quay rules', weather: { tables: { any: 'ew-quay' } } }] };
    expect(rumourWeatherErrors(alone)).toHaveLength(1);
    expect(rumourWeatherLibraryErrors([alone, setting])).toEqual([
      'rulesSets: "fen-rules" names "ew-quay" as a weather table, but The eel weirs has it as a table of rumours: a player rolling the weather would read its rumours. Name a weather table instead.',
    ]);
  });
});
