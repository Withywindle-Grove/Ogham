// npm run pack:check on rule text set out like the book (pf-18, pf-18a): the one shared check for a place rule's
// text, an area's gm.text, a GM section's text (pf-18b), a procedure step's text, a trait note (tfb-5) and a common
// player action's rule (d5-16). Invented packs; the ruling's own example.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { playerActionTextFields, ruleTextCheck, ruleTextContext, ruleTextFields, ruleTextFileCheck, traitNoteFields } from './pack-rule-text.mjs';
import { RULE_TEXT_PATH } from './pack-town.mjs';
import { formatNotes } from './pack-format.mjs';

/** The ruling's example. */
const example = () => ({
  blocks: [
    { h: 'Crossing the Mire' },
    { p: 'Each hour in the bog, the [[table:mire-hazards|Mire hazards]] table is rolled.' },
    { lead: 'Sinking', text: 'A wader who fails a check sinks to the waist.' },
    { list: ['Drop the pack', 'Grab a rope', 'Call the lantern warden'], numbered: true },
    { table: { title: 'Mire hazards', die: 'd4', columns: ['d4', 'Hazard'], rows: [['1-2', 'Leeches'], ['3-4', 'Sinkhole']] } },
    { box: [{ p: 'Optional rule: a bog lurker takes the last in line.' }], title: 'Bog lurkers' },
    { source: 'p. 12' },
  ],
});

/** An invented pack carrying rule text in every field the format allows, all valid. */
const pack = () => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'reed-marsh', name: 'The reed marsh', kind: 'setting' },
  tables: [{ id: 'mire-hazards', name: 'Mire hazards', die: 'd4', rows: [{ min: 1, max: 4, result: 'Leeches' }] }],
  rulesSets: [
    {
      id: 'reed-rules',
      name: 'Reed rules',
      procedure: [{ id: 'describe', name: 'Describe', text: 'Say what the [[table:mire-hazards|bog]] shows.' }],
      exploration: {
        modes: [
          {
            id: 'wading',
            name: 'Wading',
            procedure: [{ id: 'act', name: 'Act', text: example() }],
            camp: { procedure: [{ id: 'rest', name: 'Rest', text: { blocks: [{ p: 'Sleep on the reeds.' }] } }] },
          },
        ],
      },
    },
  ],
  locations: [
    {
      id: 'mire-causeway',
      name: 'The causeway',
      gm: { text: example(), sections: [{ heading: 'The causeway at dusk', text: example() }, { heading: 'The toll', text: 'Plain words about the [[table:mire-hazards|bog]].' }] },
      rules: [{ id: 'sinking', name: 'Sinking', text: example() }],
      procedure: [{ id: 'question', name: 'Question', text: { blocks: [{ tableRef: 'mire-hazards' }] } }],
    },
  ],
});

const ctx = () => ruleTextContext(pack());
const at = 'locations[0].gm.text';

/** Runs npm run pack:check on a pack; returns its output and exit code, and removes the file. */
const run = (file) => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-rule-text-'));
  const path = join(dir, 'rule-text.pack.json');
  writeFileSync(path, JSON.stringify(file));
  const out = spawnSync('node', ['scripts/check-pack.mjs', path], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { out: out.stdout, code: out.status };
};

describe('pack:check on rule text (pf-18)', () => {
  // Purpose: a pack carrying valid rule text in every field (blocks and plain strings) gets no error and no warning.
  it('says nothing about valid rule text in every field', () => {
    expect(ruleTextFileCheck(pack())).toEqual({ errors: [], warnings: [] });
    const { out, code } = run(pack());
    expect(code).toBe(0);
    expect(out).not.toContain('Errors (');
  });

  // Purpose: the check finds rule text in all four fields, wherever the format allows a procedure, and the town check's
  // walk leaves exactly those paths to it.
  it('finds every field, and the town check leaves those paths alone', () => {
    const paths = ruleTextFields(pack()).map(([path]) => path);
    expect(paths).toEqual([
      'locations[0].rules[0].text',
      'locations[0].gm.text',
      'locations[0].gm.sections[0].text',
      'locations[0].gm.sections[1].text',
      'locations[0].procedure[0].text',
      'rulesSets[0].procedure[0].text',
      'rulesSets[0].exploration.modes[0].procedure[0].text',
      'rulesSets[0].exploration.modes[0].camp.procedure[0].text',
    ]);
    for (const path of paths) {
      expect(RULE_TEXT_PATH.test(path)).toBe(true);
      expect(RULE_TEXT_PATH.test(`${path}.blocks[1].p`)).toBe(true);
    }
    for (const other of ['locations[0].gm.notes', 'locations[0].gm.sections[0].heading', 'locations[0].gm.textual', 'locations[0].rules[0].name', 'npcs[0].gm.text']) expect(RULE_TEXT_PATH.test(other)).toBe(false);
  });

  // Purpose: a wrong shape is an error saying where: a value that's neither words nor { blocks } (a bare list here).
  it('errs on a value that is neither words nor { blocks }', () => {
    expect(ruleTextCheck([{ p: 'Bare' }], at, ctx())).toEqual({
      errors: [`${at}: The text ([{"p":"Bare"}]) is neither words nor { "blocks": [ … ] }; left out.`],
      warnings: [],
    });
  });

  // Purpose: each block the reader leaves out is an error naming the block: no marker, a missing requirement, a box in
  // a box, a list item that isn't words.
  it("errs on each block the reader can't use", () => {
    const { errors } = ruleTextCheck({ blocks: [{ words: 'x' }, { lead: 'Sinking' }, { box: [{ box: [{ p: 'In' }] }, { p: 'Kept' }] }, { list: ['Drop', 3] }] }, at, ctx());
    expect(errors).toEqual([
      `${at}: block 1 ({"words":"x"}) has no known marker (p, h, lead, list, table, tableRef, box, source); left out.`,
      `${at}: block 2 (lead "Sinking") has no text; left out.`,
      `${at}: block 3 (box), block 1 (box) is inside a box; a box holds blocks, never another box; left out.`,
      `${at}: block 4 (list), item 2 (3) isn't words; left out.`,
    ]);
  });

  // Purpose: the checker uses the reader's own test of blocks (isRuleTextBlocks): { blocks, note } is read as blocks
  // and its note named as an error; blocks that aren't a list is an error; null is no text, as before (nothing said).
  it('uses the same test of blocks as the screens', () => {
    expect(ruleTextCheck({ blocks: [{ p: 'Wade slowly.' }], note: 'x' }, at, ctx())).toEqual({ errors: [`${at}: The text has keys besides blocks (note); they were left out.`], warnings: [] });
    expect(ruleTextCheck({ blocks: true }, at, ctx())).toEqual({ errors: [`${at}: The text's blocks should be a list of blocks; left out.`], warnings: [] });
    expect(ruleTextCheck(null, at, ctx())).toEqual({ errors: [], warnings: [] });
  });

  // Purpose: no blocks at all is a warning: the app shows nothing there.
  it('warns on { blocks: [] }', () => {
    expect(ruleTextCheck({ blocks: [] }, at, ctx())).toEqual({ errors: [], warnings: [`${at}: has no blocks; the app shows nothing. Leave the text out, or give it blocks.`] });
  });

  // Purpose: a source block that isn't the last is a warning.
  it('warns on a source block that is not the last', () => {
    expect(ruleTextCheck({ blocks: [{ source: 'p. 12' }, { p: 'After the source.' }] }, at, ctx())).toEqual({
      errors: [],
      warnings: [`${at}.blocks[0]: a source block should be the last block; the app shows the source last.`],
    });
  });

  // Purpose: an empty title, a table's or a box's (inside a box too), is a warning.
  it('warns on an empty title', () => {
    expect(ruleTextCheck({ blocks: [{ table: { title: ' ', columns: ['d4'], rows: [['1']] } }, { box: [{ p: 'Bog lurkers.' }], title: '' }] }, at, ctx()).warnings).toEqual([
      `${at}.blocks[0]: the table's title is empty.`,
      `${at}.blocks[1]: the box's title is empty; leave it out for a box with no title.`,
    ]);
  });

  // Purpose: a tableRef naming no table in the pack is a warning that says it may live in another attached pack.
  it('warns on a tableRef naming no table in the pack', () => {
    expect(ruleTextCheck({ blocks: [{ box: [{ tableRef: 'eel-weirs' }] }] }, at, ctx())).toEqual({
      errors: [],
      warnings: [`${at}.blocks[0].box[0]: tableRef "eel-weirs" names no table in this pack (fine if another attached pack has it).`],
    });
  });

  // Purpose: a link naming nothing in the pack is a warning that says it may live in another pack, in blocks and in a
  // plain string alike; a link to another pack and a rule are left alone; a kind no link may name is a warning.
  it('warns on a link naming nothing in the pack, in blocks and in a plain string', () => {
    const blocks = ruleTextCheck({ blocks: [{ lead: 'Sinking', text: 'See [[table:eel-weirs|the weirs]], [[table:fen-pack:far|far]] and [[rule:wading|wading]].' }] }, at, ctx());
    expect(blocks.warnings).toEqual([`${at}.blocks[0].text: the link to table "eel-weirs" names nothing in this pack (fine if another attached pack has it); the app shows "the weirs" as plain text.`]);
    const plain = ruleTextCheck('Ask [[npc:marda|Marda]] about [[shop:x|a stall]].', at, ctx());
    expect(plain).toEqual({
      errors: [],
      warnings: [
        `${at}: the link to npc "marda" names nothing in this pack (fine if another attached pack has it); the app shows "Marda" as plain text.`,
        `${at}: the link [[shop:x|a stall]] names "shop", which isn't a kind a link may name (place, npc, item, table, statBlock, spell, rule, adventureHook).`,
      ],
    });
  });

  // Purpose: a link naming nothing inside a rule text is said once, by this check, not again by the town check.
  it('says a broken link in rule text once', () => {
    const p = pack();
    p.locations[0].gm.text = { blocks: [{ p: 'See [[table:eel-weirs|the weirs]].' }] };
    expect(formatNotes(p).filter((n) => n.includes('eel-weirs'))).toEqual([
      'locations[0].gm.text.blocks[0].p: the link to table "eel-weirs" names nothing in this pack (fine if another attached pack has it); the app shows "the weirs" as plain text.',
    ]);
  });

  // Purpose: a town's GM section in blocks (pf-18b) is checked by the one rule-text rule: a good one says nothing, a bad one errs saying where.
  it("checks a town's GM section by the one rule", () => {
    expect(ruleTextFileCheck(pack()).errors).toEqual([]);
    const bad = pack();
    bad.locations[0].gm.sections[0].text = { blocks: [{ p: 'Fine.' }, { lead: 'The toll' }] };
    expect(ruleTextFileCheck(bad).errors).toEqual(['locations[0].gm.sections[0].text: block 2 (lead "The toll") has no text; left out.']);
    const failed = run(bad);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain('locations[0].gm.sections[0].text: block 2 (lead "The toll") has no text; left out.');
  });

  // Purpose: a link naming nothing inside a town's GM section is said exactly once, in blocks and in a plain string, by
  // this check, not again by the town check.
  it("says a broken link in a town's GM section once", () => {
    const p = pack();
    p.locations[0].gm.sections = [
      { heading: 'In blocks', text: { blocks: [{ box: [{ p: 'See [[table:eel-weirs|the weirs]].' }] }] } },
      { heading: 'Plain', text: 'Ask [[npc:marda|Marda]].' },
    ];
    expect(formatNotes(p).filter((n) => n.includes('eel-weirs') || n.includes('marda'))).toEqual([
      'locations[0].gm.sections[0].text.blocks[0].box[0].p: the link to table "eel-weirs" names nothing in this pack (fine if another attached pack has it); the app shows "the weirs" as plain text.',
      'locations[0].gm.sections[1].text: the link to npc "marda" names nothing in this pack (fine if another attached pack has it); the app shows "Marda" as plain text.',
    ]);
  });

  // Purpose: errors print under their own heading and make npm run pack:check exit 1; warnings join the format notes
  // and leave it at 0.
  it('reports from the command line: errors exit 1, warnings exit 0', () => {
    const broken = pack();
    broken.rulesSets[0].exploration.modes[0].procedure[0].text = { blocks: [{ lead: 'Sinking' }] };
    const failed = run(broken);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain('Errors (1):\n  - rulesSets[0].exploration.modes[0].procedure[0].text: block 1 (lead "Sinking") has no text; left out.');
    const warned = pack();
    warned.locations[0].rules[0].text = { blocks: [{ source: 'p. 12' }, { p: 'Late.' }] };
    const noted = run(warned);
    expect(noted.code).toBe(0);
    expect(noted.out).toContain('locations[0].rules[0].text.blocks[0]: a source block should be the last block');
  });
});

/** An invented pack whose class and kindred carry trait notes: plain words, in blocks, and a kindred's option's. */
const traitPack = () => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'reed-marsh', name: 'The reed marsh', kind: 'setting' },
  classes: [
    {
      id: 'lantern-warden',
      name: 'Lantern Warden',
      abilities: [
        { name: 'Shield wall', note: 'Stand shoulder to shoulder with one ally.' },
        {
          name: 'Banner right',
          fromLevel: 3,
          note: { blocks: [{ p: 'A warden of the first two levels marches under another banner.' }, { lead: 'Hearth-right', text: 'A bed and a meal at any hall that flies one.' }, { list: ['No pay from its enemies.'] }] },
        },
        { name: 'Quiet step' },
      ],
    },
  ],
  races: [
    {
      id: 'bog-folk',
      name: 'Bog folk',
      abilities: [{ name: 'Hold breath', note: { blocks: [{ p: 'Under water for a long while.' }] } }],
      optionalAbilities: { option: 'reed-ways', abilities: [{ name: 'Reed path', note: 'Walks the reeds unseen.' }] },
    },
  ],
});

describe('pack:check on a trait note (tfb-5)', () => {
  // Purpose: a trait note is found on a class, a kindred and a kindred's optional abilities, and nowhere it isn't written.
  it('finds every trait note', () => {
    expect(traitNoteFields(traitPack()).map(([path]) => path)).toEqual([
      'classes[0].abilities[0].note',
      'classes[0].abilities[1].note',
      'races[0].abilities[0].note',
      'races[0].optionalAbilities.abilities[0].note',
    ]);
  });

  // Purpose: pack:check accepts a trait note in plain words and one in blocks, with no error and no warning.
  it('accepts plain words and blocks', () => {
    expect(ruleTextFileCheck(traitPack())).toEqual({ errors: [], warnings: [] });
    const { out, code } = run(traitPack());
    expect(code).toBe(0);
    expect(out).not.toContain('Errors (');
  });

  // Purpose: pack:check refuses a malformed block in a trait note, saying which trait note and which block, and exits 1.
  it('refuses a malformed block, saying where', () => {
    const bad = traitPack();
    bad.classes[0].abilities[1].note = { blocks: [{ p: 'Fine.' }, { lead: 'Hearth-right' }, { p: '' }, { quote: 'Not a block.' }] };
    expect(ruleTextFileCheck(bad).errors).toEqual([
      'classes[0].abilities[1].note: block 2 (lead "Hearth-right") has no text; left out.',
      'classes[0].abilities[1].note: block 3 (p) has no words; left out.',
      'classes[0].abilities[1].note: block 4 ({"quote":"Not a block."}) has no known marker (p, h, lead, list, table, tableRef, box, source); left out.',
    ]);
    const failed = run(bad);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain('classes[0].abilities[1].note: block 2 (lead "Hearth-right") has no text; left out.');
  });

  // Purpose: a trait note that is neither words nor { blocks } (a bare list, a number) is refused with a clear line.
  it('refuses a note that is neither words nor blocks', () => {
    const bad = traitPack();
    bad.races[0].abilities[0].note = [{ p: 'A bare list.' }];
    bad.classes[0].abilities[0].note = 7;
    expect(ruleTextFileCheck(bad).errors).toEqual([
      'classes[0].abilities[0].note: The text (7) is neither words nor { "blocks": [ … ] }; left out.',
      'races[0].abilities[0].note: The text ([{"p":"A bare list."}]) is neither words nor { "blocks": [ … ] }; left out.',
    ]);
  });

  // Purpose: a trait a choice gives (a class's or a kindred's byOption) is checked too: the app reads it once the choice is made (review of #1076).
  it('checks the abilities a byOption choice gives', () => {
    const p = traitPack();
    p.races[0].byOption = { 'reed-ways=deep': { abilities: [{ name: 'Mud sense', note: { blocks: [{ p: 'Feels a step in the mud.' }] } }] } };
    p.classes[0].byOption = { 'reed-ways=deep': { abilities: [{ name: 'Fen lamp', note: { blocks: [{ lead: 'Alone' }] } }] } };
    expect(traitNoteFields(p).map(([path]) => path).filter((path) => path.includes('byOption'))).toEqual(['classes[0].byOption["reed-ways=deep"].abilities[0].note', 'races[0].byOption["reed-ways=deep"].abilities[0].note']);
    expect(ruleTextFileCheck(p).errors).toEqual(['classes[0].byOption["reed-ways=deep"].abilities[0].note: block 1 (lead "Alone") has no text; left out.']);
  });

  // Purpose: a broken link inside a trait note in blocks is said once (by the town check, which reads every string), not twice.
  it('says a broken link in a trait note once', () => {
    const p = traitPack();
    p.classes[0].abilities[1].note = { blocks: [{ p: 'See [[table:eel-weirs|the weirs]].' }] };
    expect(ruleTextFileCheck(p).warnings).toEqual([]);
    expect(formatNotes(p).filter((n) => n.includes('eel-weirs'))).toHaveLength(1);
  });
});

/** An invented pack whose rules set lists common player actions: one in plain words, one in blocks (01-08j's shape), one with no rule. */
const actionsPack = () => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'reed-actions', name: 'Reed actions', kind: 'setting' },
  rulesSets: [
    {
      id: 'reed-rules',
      name: 'Reed rules',
      exploration: {
        playerActions: [
          { id: 'listen', name: 'Listen', group: 'Doors', text: 'Hold still at the door and listen.' },
          {
            id: 'force',
            name: 'Force a door',
            group: 'Doors',
            text: {
              blocks: [
                { p: 'A stuck door may be forced by one character at a time.' },
                { p: 'Roll a d6: the door opens on a 1 or a 2.' },
                { table: { title: 'Modifiers', columns: ['When', 'The door opens on'], rows: [['With a crowbar', '1 to 3'], ['An iron-bound door', '1 only']] } },
                { lead: 'Time and noise', text: 'Each try takes a turn and is loud.' },
              ],
            },
            source: 'Reed Rules, p. 88',
          },
          { id: 'shout', name: 'Shout', group: 'Noise' },
        ],
      },
    },
  ],
});

describe("pack:check on a common player action's rule (d5-16)", () => {
  // Purpose: an action's rule is found on a rules set's playerActions, and nowhere an action carries none.
  it('finds every action rule', () => {
    expect(playerActionTextFields(actionsPack()).map(([path]) => path)).toEqual(['rulesSets[0].exploration.playerActions[0].text', 'rulesSets[0].exploration.playerActions[1].text']);
  });

  // Purpose: pack:check accepts an action's rule in plain words and one in blocks, with no error and no warning.
  it('accepts plain words and blocks', () => {
    expect(ruleTextFileCheck(actionsPack())).toEqual({ errors: [], warnings: [] });
    const { out, code } = run(actionsPack());
    expect(code).toBe(0);
    expect(out).not.toContain('Errors (');
  });

  // Purpose: pack:check refuses a malformed block in an action's rule, saying which action and which block, and exits 1.
  it('refuses a malformed block, saying where', () => {
    const bad = actionsPack();
    bad.rulesSets[0].exploration.playerActions[1].text = { blocks: [{ p: 'Fine.' }, { lead: 'Time and noise' }, { table: { title: 'Modifiers', columns: ['When'] } }] };
    expect(ruleTextFileCheck(bad).errors).toEqual([
      'rulesSets[0].exploration.playerActions[1].text: block 2 (lead "Time and noise") has no text; left out.',
      'rulesSets[0].exploration.playerActions[1].text: block 3 (table "Modifiers") rows should be a list of rows, each a list of cells; left out.',
    ]);
    const failed = run(bad);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain('rulesSets[0].exploration.playerActions[1].text: block 2 (lead "Time and noise") has no text; left out.');
  });

  // Purpose: an action's rule that is neither words nor { blocks } (a bare list, a number) is refused with a clear line.
  it('refuses a rule that is neither words nor blocks', () => {
    const bad = actionsPack();
    bad.rulesSets[0].exploration.playerActions[0].text = [{ p: 'A bare list.' }];
    expect(ruleTextFileCheck(bad).errors).toEqual(['rulesSets[0].exploration.playerActions[0].text: The text ([{"p":"A bare list."}]) is neither words nor { "blocks": [ … ] }; left out.']);
  });

  // Purpose: a broken link inside an action's rule in blocks is said once (by the town check, which reads every string), not twice.
  it('says a broken link in an action rule once', () => {
    const p = actionsPack();
    p.rulesSets[0].exploration.playerActions[1].text = { blocks: [{ p: 'See [[table:eel-weirs|the weirs]].' }] };
    expect(ruleTextFileCheck(p).warnings).toEqual([]);
    expect(formatNotes(p).filter((n) => n.includes('eel-weirs'))).toHaveLength(1);
  });
});

describe('existing packs report as before', () => {
  // Purpose: the fixtures whose modes carry procedures (no rule text in blocks) get no new line from this check.
  it('adds nothing for the existing fixtures', () => {
    for (const name of ['g07-format', 'm5b-creation', 'options-gates-4']) {
      const file = JSON.parse(readFileSync(`scripts/fixtures/${name}.fixture.json`, 'utf8'));
      expect(ruleTextFileCheck(file)).toEqual({ errors: [], warnings: [] });
      const { out, code } = (() => {
        const r = spawnSync('node', ['scripts/check-pack.mjs', `scripts/fixtures/${name}.fixture.json`], { encoding: 'utf8' });
        return { out: r.stdout, code: r.status };
      })();
      expect(code).toBe(0);
      expect(out).not.toContain('Errors (');
    }
  });
});
