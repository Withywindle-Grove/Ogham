// Tests for seeding overlays on their base and one campaign per creation method (scripts/seed-plan.mjs). Invented
// packs only, built from scripts/fixtures/m5b-creation.fixture.json. No network.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readPackJson } from '../src/modules/library/packFile.ts';
import { chainOf, mergeEntries, otherMethods, placeOverlaysOf, planFolder, planPack, planSetting } from './seed-plan.mjs';

const fixture = resolve(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/m5b-creation.fixture.json');
const read = readPackJson(readFileSync(fixture, 'utf8'));
if (!read.ok) throw new Error(read.message);

const base = () => {
  const pack = structuredClone(read.pack);
  pack.meta.extra = { ...pack.meta.extra, id: 'fen-base' };
  return pack;
};
/** An invented overlay that adds one class asking for a score only the base's rules set defines. */
const overlay = (requires = ['fen-base']) => ({
  meta: { name: 'Invented overlay', version: '1', kind: 'homebrew', formatVersion: 2, source: '', notes: '', extra: { id: 'fen-over', requires } },
  entries: [{ kind: 'class', packEntryId: 'marsh-poet', name: 'Marsh Poet', data: { hitDie: 'd4', requirements: { WIT: 9 }, creationMethods: ['kindred-first'], raceMaxLevels: { 'bog-folk': 6, 'stone-kin': 6 } } }],
  counts: {},
  warnings: [],
  problems: [],
});
const adventure = () => ({ meta: { name: 'Invented trek', version: '1', kind: 'adventure', formatVersion: 2, source: '', notes: '', extra: { id: 'fen-trek', requires: ['fen-base'] } }, entries: [], counts: {}, warnings: [], problems: [] });
/** An invented region pack: places and no classes, on the base. */
const region = (requires = ['fen-base']) => ({
  meta: { name: 'Invented reaches', version: '1', kind: 'homebrew', formatVersion: 2, source: '', notes: '', extra: { id: 'fen-reaches', requires } },
  entries: [{ kind: 'location', packEntryId: 'the-reed-inn', name: 'The Reed Inn', data: { type: 'building' } }],
  counts: {},
  warnings: [],
  problems: [],
});

describe('place packs attached on top (M8b slice 0)', () => {
  // Purpose: a pack of places with no classes that sits on a setting is attached to that setting's campaigns, so the
  // picker has places; it is never seeded on its own, and a pack that needs another base is not attached here.
  it('a region pack on the base is listed as an overlay of the base, and skipped on its own', () => {
    const plans = planFolder([base(), region()]);
    const own = plans.find((p) => p.packName === 'Invented creation sample');
    expect(own.overlays.map((p) => p.meta.name)).toEqual(['Invented reaches']);
    const places = plans.find((p) => p.packName === 'Invented reaches');
    expect(places.campaigns).toEqual([]);
    expect(places.note).toContain('no classes of its own');
  });

  it('an overlay with classes, an adventure with no places, or a pack on another base is not a place overlay', () => {
    const all = [base(), overlay(), adventure(), region(['elsewhere'])];
    expect(placeOverlaysOf(base(), all)).toEqual([]);
    expect(placeOverlaysOf(all[0], all)).toEqual([]);
    expect(placeOverlaysOf(all[0], [...all, region()]).map((p) => p.meta.name)).toEqual(['Invented reaches']);
  });
});

describe('overlays seeded on their base', () => {
  // Purpose: an overlay with classes is seeded on top of the pack it needs, so its scores and rules exist; on its own it
  // cannot make anyone.
  it('seeds nothing from the overlay alone (no ability scores in its rules), and says why', () => {
    const alone = planSetting([overlay()]);
    expect(alone.campaigns).toEqual([]);
    expect(alone.note).toContain('no ability scores');
  });

  it('puts the base first and the overlay on top, and makes the overlay class a character', () => {
    const plans = planFolder([base(), overlay()]);
    const over = plans.find((p) => p.packName.includes('Invented overlay'));
    expect(over.chain.map((p) => p.meta.name)).toEqual(['Invented creation sample', 'Invented overlay']);
    expect(over.campaigns[0].name).toBe('Seed · Invented creation sample + Invented overlay · defaults');
    expect(over.campaigns[0].characters.some((c) => c.className === 'Marsh Poet')).toBe(true);
    // The base is still seeded on its own, without the overlay's class.
    const own = plans.find((p) => p.packName === 'Invented creation sample');
    expect(own.campaigns[0].characters.some((c) => c.className === 'Marsh Poet')).toBe(false);
  });

  it('lets the higher pack win when both have the same entry', () => {
    const top = overlay();
    top.entries.push({ kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden (changed)', data: { hitDie: 'd10' } });
    const merged = mergeEntries([base(), top]);
    expect(merged.filter((e) => e.kind === 'class' && e.packEntryId === 'lantern-warden')).toHaveLength(1);
    expect(merged.find((e) => e.packEntryId === 'lantern-warden').name).toBe('Lantern Warden (changed)');
  });

  it('finds a base that itself needs a base, lowest first', () => {
    const middle = { ...overlay(['fen-base']), meta: { ...overlay().meta, extra: { id: 'fen-mid', requires: ['fen-base'] } } };
    const top = overlay(['fen-mid']);
    expect(chainOf(top, [base(), middle, top]).chain.map((p) => p.meta.extra.id)).toEqual(['fen-base', 'fen-mid', 'fen-over']);
  });

  it('never seeds an adventure that only sits on a base, and says so', () => {
    const plan = planFolder([base(), adventure()]).find((p) => p.packName === 'Invented trek');
    expect(plan.campaigns).toEqual([]);
    expect(plan.note).toContain('no classes of its own');
  });

  it('seeds an overlay without its base on its own and says what is missing', () => {
    const plan = planFolder([overlay(['not-in-the-folder'])])[0];
    expect(plan.note).toContain('not-in-the-folder');
    expect(plan.chain).toHaveLength(1);
  });
});

describe('one campaign per creation method', () => {
  // Purpose: a creation method the default does not offer gets its own campaign, so characters made that way exist too.
  it('adds nothing when the default already offers both methods', () => {
    expect(otherMethods(read.pack.entries)).toEqual([]);
    expect(planPack(read.pack).campaigns.map((c) => c.mode)).toEqual(['defaults', 'options on']);
  });

  it('adds a campaign for the method the default leaves out, with that method chosen', () => {
    const pack = base();
    pack.entries.find((e) => e.kind === 'option' && e.packEntryId === 'creation-path').data.default = 'kindred-first';
    expect(otherMethods(pack.entries).map((m) => m.id)).toEqual(['calling-only']);
    const plan = planSetting([pack]);
    const extra = plan.campaigns.find((c) => c.mode === 'Calling as kindred');
    expect(extra.name).toBe('Seed · Invented creation sample · Calling as kindred');
    expect(extra.choices['creation-path']).toBe('calling-only');
    expect(extra.characters.length).toBeGreaterThan(0);
    expect(extra.characters.every((c) => c.raceId === null)).toBe(true); // that method has no separate kindred
  });
});

describe('a summary that only shows real problems', () => {
  // Purpose: a class one method does not offer is not "left out" when another campaign of the setting makes it, and a
  // setting whose method has no race step does not complain about races.
  const withDefault = (method, extraClass) => {
    const pack = base();
    pack.entries.find((e) => e.kind === 'option' && e.packEntryId === 'creation-path').data.default = method;
    if (extraClass) pack.entries.push({ kind: 'class', packEntryId: extraClass.id, name: extraClass.name, data: { hitDie: 'd6', creationMethods: extraClass.methods } });
    return pack;
  };

  it('drops the "doesn\'t offer it" line for a class the extra method campaign makes, and keeps it for one nothing makes', () => {
    const plan = planSetting([withDefault('kindred-first', { id: 'sluice-hand', name: 'Sluice Hand', methods: ['calling-only'] })]);
    const defaults = plan.campaigns.find((c) => c.mode === 'defaults');
    expect(defaults.skipped.some((s) => s.className === 'Sluice Hand')).toBe(false);
    expect(plan.campaigns.find((c) => c.mode === 'Calling as kindred').characters.some((c) => c.className === 'Sluice Hand')).toBe(true);
    const lost = planSetting([withDefault('kindred-first', { id: 'ghost-hand', name: 'Ghost Hand', methods: ['no-such-method'] })]);
    expect(lost.campaigns.find((c) => c.mode === 'defaults').skipped.some((s) => s.className === 'Ghost Hand')).toBe(true);
  });

  it('does not list kindreds as uncovered when the method has no kindred step', () => {
    const plan = planSetting([withDefault('calling-only')]);
    expect(plan.campaigns.find((c) => c.mode === 'defaults').uncovered).toEqual([]);
  });
});
