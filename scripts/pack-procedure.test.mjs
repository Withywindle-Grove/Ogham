// npm run pack:check reads a `procedure` on a place and on the rules set (pf-14, pf-14a), dec-9 piece C (the checker's
// rules only). Invented packs; step names are the app's own five (Describe, Question, Act, Test, Resolve) or invented.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { procedureCheck } from './pack-procedure.mjs';
import { ruleTextFileCheck } from './pack-rule-text.mjs';
import { formatNotes } from './pack-format.mjs';

/** The app's own five steps, as a valid procedure. */
const five = () => [
  { id: 'describe', name: 'Describe', icon: 'trumpet-flag' },
  { id: 'question', name: 'Question', icon: 'crystal-ball' },
  { id: 'act', name: 'Act', icon: 'sword-brandish' },
  { id: 'test', name: 'Test', icon: 'pointy-hat', kind: 'check', checkId: 'reed-wanderers' },
  { id: 'resolve', name: 'Resolve', icon: 'locked-chest' },
];

/** An invented pack: a rules set with one mode and its check, a region and a place in it. No procedure yet. */
const pack = () => ({
  format: 'tabletop-pack',
  formatVersion: 3,
  meta: { id: 'reed-marsh', name: 'The reed marsh', kind: 'setting' },
  rulesSets: [
    {
      id: 'reed-rules',
      name: 'Reed rules',
      exploration: { modes: [{ id: 'wading', name: 'Wading', checks: [{ id: 'reed-wanderers', name: 'Wanderers', every: { value: 2, unit: 'turn' } }] }] },
    },
  ],
  locations: [
    { id: 'reed-fen', name: 'The fen', type: 'region' },
    { id: 'reed-jetty', name: 'The jetty', type: 'area', parentId: 'reed-fen', encounterCheck: { id: 'jetty-eels', name: 'Eels', every: { value: 1, unit: 'turn' } } },
  ],
  items: [{ id: 'reed-rope', name: 'Reed rope' }],
});

/** Runs npm run pack:check on a pack; returns its output and exit code. */
const run = (file) => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-procedure-'));
  const path = join(dir, 'procedure.pack.json');
  writeFileSync(path, JSON.stringify(file));
  const out = spawnSync('node', ['scripts/check-pack.mjs', path], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { out: out.stdout, code: out.status };
};

describe('a procedure on a place and on the rules set (pf-14)', () => {
  // Purpose: a pack with no procedure anywhere is fine, and nothing is said.
  it('says nothing when no procedure is anywhere', () => {
    expect(procedureCheck(pack())).toEqual({ errors: [], warnings: [] });
  });

  // Purpose: a valid procedure on a place (a region and a location) and on the rules set passes silently.
  it('passes a valid procedure on a region, a location and the rules set without a word', () => {
    const p = pack();
    p.rulesSets[0].procedure = five();
    p.locations[0].procedure = five();
    p.locations[1].procedure = [{ id: 'listen', name: 'Listen at the planks', text: 'The planks creak.' }, ...five()];
    expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
    const { out, code } = run(p);
    expect(code).toBe(0);
    expect(out).not.toContain('procedure');
  });

  // Purpose: a procedure that isn't a list of steps is an error that says where it is.
  it('errs on a procedure that is not a list of steps, saying where', () => {
    const p = pack();
    p.locations[1].procedure = { id: 'describe', name: 'Describe' };
    p.rulesSets[0].procedure = ['Describe', ...five()];
    expect(procedureCheck(p).errors).toEqual([
      'locations: "reed-jetty": procedure should be a list of steps, each { id, name, icon?, kind?, checkId?, text? }.',
      'rulesSets: "reed-rules": procedure step 1 isn\'t a step; write { id, name, icon?, kind?, checkId?, text? }.',
    ]);
  });

  // Purpose: a step with no id, a step with no name, and two steps sharing an id are errors.
  it('errs on a step with no id or no name, and on two steps with one id', () => {
    const p = pack();
    p.locations[0].procedure = [{ name: 'Describe' }, { id: 'question' }, { id: 'act', name: 'Act' }, { id: 'act', name: 'Act again' }];
    expect(procedureCheck(p).errors).toEqual([
      'locations: "reed-fen": procedure step "Describe" has no id.',
      'locations: "reed-fen": procedure step "question" has no name.',
      'locations: "reed-fen": procedure has two steps with the id "act"; each step needs its own.',
    ]);
  });

  // Purpose: errors make npm run pack:check exit 1, under their own heading.
  it('reports the errors from the command line and exits 1', () => {
    const p = pack();
    p.locations[0].procedure = [{ id: 'question' }];
    const { out, code } = run(p);
    expect(code).toBe(1);
    expect(out).toContain('Errors (1):\n  - locations: "reed-fen": procedure step "question" has no name.');
  });

  // Purpose: a checkId that names no check in the pack is a warning that says it may live in another pack.
  it('warns on a checkId that names no check in this pack', () => {
    const p = pack();
    p.rulesSets[0].procedure = [{ id: 'test', name: 'Test', kind: 'check', checkId: 'bog-lurker-stirs' }];
    expect(procedureCheck(p)).toEqual({
      errors: [],
      warnings: ['rulesSets: "reed-rules": procedure step "test": checkId "bog-lurker-stirs" names no check in this pack (fine if another attached pack has it).'],
    });
    expect(formatNotes(p)).toContain('rulesSets: "reed-rules": procedure step "test": checkId "bog-lurker-stirs" names no check in this pack (fine if another attached pack has it).');
    expect(run(p).code).toBe(0);
  });

  // Purpose: a place's encounterCheck has no id in the format (07), so a check step can't name one; it is warned.
  it("doesn't count a place's encounterCheck as a check a step may name", () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'test', name: 'Test', kind: 'check', checkId: 'jetty-eels' }];
    expect(procedureCheck(p)).toEqual({
      errors: [],
      warnings: ['locations: "reed-jetty": procedure step "test": checkId "jetty-eels" names no check in this pack (fine if another attached pack has it).'],
    });
  });

  // Purpose: a checkId on a step that isn't a check step gets no note, as on a mode's step, so one step reads the same
  // wherever it sits.
  it('says nothing about a checkId on a step whose kind is not check', () => {
    const p = pack();
    p.locations[0].procedure = [{ id: 'listen', name: 'Listen', checkId: 'bog-lurker-stirs' }, { id: 'note', name: 'Note', kind: 'note', checkId: 'bog-lurker-stirs' }];
    expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
  });

  // Purpose: a step's kind that isn't one of the step kinds gets the note a mode's step gets, as a warning.
  it("warns on a step's kind that is not one of the step kinds", () => {
    const p = pack();
    p.rulesSets[0].procedure = [{ id: 'wade', name: 'Wade', kind: 'splash' }, { id: 'resolve', name: 'Resolve', kind: 'note' }];
    expect(procedureCheck(p)).toEqual({
      errors: [],
      warnings: ['rulesSets: "reed-rules": procedure step "wade": kind "splash" isn\'t one of note, roll, check, camp, watches, auto.'],
    });
  });

  // Purpose: a step's text that is non-empty words passes.
  it("passes a step's text that is words", () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'test', name: 'Test', text: 'The planks creak.' }];
    expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
  });

  // Purpose: a step's text that is { blocks } with a non-empty list of objects passes (the blocks' inner keys aren't
  // checked here).
  it("passes a step's text that is { blocks: [ … ] }", () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'resolve', name: 'Resolve', text: { blocks: [{ lead: 'Eels', text: 'They bite.' }, { anything: 'goes, for now' }] } }];
    expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
  });

  // A step's text is checked once, by the shared rule-text check (pf-18, pf-18a), in its words and at its levels; the
  // procedure check says nothing about it. `both` is what the checker reports from the two together.
  const both = (p) => {
    const procedure = procedureCheck(p);
    const text = ruleTextFileCheck(p);
    return { errors: [...procedure.errors, ...text.errors], warnings: [...procedure.warnings, ...text.warnings] };
  };
  const refused = (text) => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'act', name: 'Act', text }];
    return both(p);
  };
  const AT = 'locations[1].procedure[0].text';
  const notText = (shown) => `${AT}: The text (${shown}) is neither words nor { "blocks": [ … ] }; left out.`;

  // Purpose: the procedure check alone no longer looks at the shape of a step's text that isn't blank.
  it("leaves the shape of a step's text to the shared rule-text check", () => {
    for (const text of [7, [{ lead: 'Eels' }], {}, { blocks: [] }, { blocks: [{ odd: 'x' }] }]) {
      const p = pack();
      p.locations[1].procedure = [{ id: 'act', name: 'Act', text }];
      expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
    }
  });

  // Purpose: a bare list of blocks, not wrapped in { blocks }, is one error, in the shared words.
  it("refuses a step's text that is a bare list, once", () => {
    expect(refused([{ lead: 'Eels', text: 'They bite.' }])).toEqual({ errors: [notText('[{"lead":"Eels","text":"They bite."}]')], warnings: [] });
  });

  // Purpose: an object without blocks is one error, in the shared words.
  it("refuses a step's text that is {}, once", () => {
    expect(refused({})).toEqual({ errors: [notText('{}')], warnings: [] });
  });

  // Purpose: { blocks } with no blocks is the shared check's warning (the app shows nothing), not an error.
  it("warns once on a step's text that is { blocks: [] }", () => {
    expect(refused({ blocks: [] })).toEqual({ errors: [], warnings: [`${AT}: has no blocks; the app shows nothing. Leave the text out, or give it blocks.`] });
  });

  // Purpose: a number is one error, in the shared words.
  it("refuses a step's text that is a number, once", () => {
    expect(refused(7)).toEqual({ errors: [notText('7')], warnings: [] });
  });

  // Purpose: a block with no known marker key is one error naming the block, in the shared words.
  it("refuses a step's block with no known marker, once", () => {
    expect(refused({ blocks: [{ lead: 'Eels', text: 'They bite.' }, { anything: 'goes' }] })).toEqual({
      errors: [`${AT}: block 2 ({"anything":"goes"}) has no known marker (p, h, lead, list, table, tableRef, box, source); left out.`],
      warnings: [],
    });
  });

  // Purpose: true and blocks that aren't objects are the shared check's one error.
  it("refuses a step's text that is true, or blocks that aren't objects, once", () => {
    expect(refused(true)).toEqual({ errors: [notText('true')], warnings: [] });
    expect(refused({ blocks: ['Eels bite.'] })).toEqual({ errors: [`${AT}: block 1 ("Eels bite.") isn't a block; left out.`], warnings: [] });
  });

  /** The procedure check's error for a step's text that is there but blank (the lead, 2026-11-13). */
  const blankError = (shown) => `locations: "reed-jetty": procedure step "act": text should be the step's own words, or { "blocks": [ … ] } with at least one block, not ${shown}.`;

  // Purpose: a step's text that is there but blank (empty, only spaces, or null) is refused once, by the procedure
  // check: a step with text is a tap that opens something, and blank words would open nothing.
  it("refuses a step's text that is empty, only spaces or null, once", () => {
    for (const [text, shown] of [['', '""'], ['   ', '"   "'], [null, 'null']]) {
      expect(refused(text)).toEqual({ errors: [blankError(shown)], warnings: [] });
    }
  });

  // Purpose: through npm run pack:check, each blank text is one error and exit 1.
  it('prints a blank step text once and exits 1', () => {
    for (const [text, shown] of [['', '""'], ['   ', '"   "'], [null, 'null']]) {
      const p = pack();
      p.locations[1].procedure = [{ id: 'act', name: 'Act', text }];
      const { out, code } = run(p);
      expect(code).toBe(1);
      expect(out).toContain(`Errors (1):\n  - ${blankError(shown)}`);
      expect(out.match(/procedure\[0\]\.text|procedure step "act"/g)).toHaveLength(1);
    }
  });

  // Purpose: a step with no text at all passes.
  it('passes a step with no text', () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'act', name: 'Act' }];
    expect(both(p)).toEqual({ errors: [], warnings: [] });
    expect(run(p).code).toBe(0);
  });

  // Purpose: npm run pack:check prints one fault in a step's text once, and exits 1.
  it('prints one fault in a step\'s text once', () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'act', name: 'Act', text: 7 }];
    const { out, code } = run(p);
    expect(code).toBe(1);
    expect(out).toContain(`Errors (1):\n  - ${notText('7')}`);
    expect(out.match(/procedure\[0\]\.text|procedure step "act"/g)).toHaveLength(1);
  });

  // Purpose: npm run pack:check passes a step's text of { blocks: [] } (exit 0) and prints its warning once.
  it('passes { blocks: [] } with its warning printed once', () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'act', name: 'Act', text: { blocks: [] } }];
    const { out, code } = run(p);
    expect(code).toBe(0);
    expect(out).not.toContain('Errors (');
    const warning = `${AT}: has no blocks; the app shows nothing. Leave the text out, or give it blocks.`;
    expect(out.split(warning)).toHaveLength(2);
    expect(out.match(/procedure\[0\]\.text|procedure step "act"/g)).toHaveLength(1);
  });

  // Purpose: a step's icon is never checked here: an unknown name falls back in the app (pf-12c).
  it('says nothing about an unknown icon', () => {
    const p = pack();
    p.locations[1].procedure = [{ id: 'describe', name: 'Describe', icon: 'no-such-icon-anywhere' }];
    expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
    expect(formatNotes(p).filter((n) => n.includes('no-such-icon-anywhere'))).toEqual([]);
  });

  // Purpose: a procedure on any other kind of entry is a warning naming the entry.
  it('warns on a procedure on an entry that is not a mode, a place or the rules set', () => {
    const p = pack();
    p.items[0].procedure = five();
    expect(procedureCheck(p)).toEqual({
      errors: [],
      warnings: ['items: "reed-rope" has a procedure; only an exploration mode, a place or the rules set may carry one, so the app won\'t read it.'],
    });
  });
});

describe("a mode's procedure reports as before", () => {
  // Purpose: the fixtures whose modes (and camps) already carry procedures get no new line, error or warning.
  it('adds nothing for the existing fixtures with a mode procedure', () => {
    for (const name of ['g07-format', 'm5b-creation', 'options-gates-4']) {
      const file = JSON.parse(readFileSync(`scripts/fixtures/${name}.fixture.json`, 'utf8'));
      expect(procedureCheck(file)).toEqual({ errors: [], warnings: [] });
      const out = execFileSync('node', ['scripts/check-pack.mjs', `scripts/fixtures/${name}.fixture.json`], { encoding: 'utf8' });
      expect(out).not.toContain('Errors (');
    }
  });

  // Purpose: a broken step inside a mode is still said the way it is today, not as one of the new errors.
  it("leaves a mode's own steps to today's checks", () => {
    const p = pack();
    p.rulesSets[0].exploration.modes[0].procedure = [{ name: 'Describe' }];
    expect(procedureCheck(p)).toEqual({ errors: [], warnings: [] });
  });
});
