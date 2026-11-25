// npm run pack:check on a pack's bundle (B14, p2p-27): a .zip of the pack file and its pictures, read with the app's
// own reader and Node's zlib. Invented pack: Saltwick Island, with two maps.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeZip } from '../src/testing/makeZip.ts';

const pack = {
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'saltwick-island', name: 'Saltwick Island', kind: 'adventure' },
  locations: [
    { id: 'drowned-harbour', name: 'The Drowned Harbour' },
    { id: 'shingle-beach', name: 'The Shingle Beach' },
  ],
  images: [
    { id: 'map-harbour', file: 'images/map-harbour.png', type: 'map', title: 'The Drowned Harbour', alt: 'A harbour, half under water.', locationIds: ['drowned-harbour'] },
    { id: 'map-beach', file: 'images/map-beach.png', type: 'map', title: 'The Shingle Beach', alt: 'A long beach of grey stones.', locationIds: ['shingle-beach'] },
  ],
};

/** Runs npm run pack:check on these bytes saved under this name; its output and exit code; the file removed. */
const run = (name, bytes) => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-bundle-'));
  const path = join(dir, name);
  writeFileSync(path, bytes);
  const out = spawnSync('node', ['scripts/check-pack.mjs', path], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { out: out.stdout + out.stderr, code: out.status };
};

describe('pack:check on a bundle', () => {
  // Purpose: the pack inside a bundle is checked as any pack file is, and a missing picture is named without failing.
  it('checks the pack inside and names a missing picture; the exit code stays 0', async () => {
    const result = run('saltwick-island.zip', await makeZip({ 'saltwick-island/saltwick-island.pack.json': JSON.stringify(pack), 'saltwick-island/images/map-harbour.png': 'a harbour' }));
    expect(result.out).toContain('Saltwick Island');
    expect(result.out).toContain('Bundle: the pack file is saltwick-island.pack.json; pictures for 1 of 2 maps.');
    expect(result.out).toContain('Missing pictures (1; the pack still imports, and each can be added by hand):\n  - images/map-beach.png (the map "The Shingle Beach")');
    expect(result.code).toBe(0);
  });

  // Purpose: with every picture there, nothing is said to be missing.
  it('says nothing is missing when every picture is there', async () => {
    const result = run('saltwick-island.zip', await makeZip({ 'saltwick-island.pack.json': JSON.stringify(pack), 'images/map-harbour.png': 'a harbour', 'images/map-beach.png': 'a beach' }));
    expect(result.out).toContain('pictures for 2 of 2 maps.');
    expect(result.out).not.toContain('Missing pictures');
    expect(result.code).toBe(0);
  });

  // Purpose: a plain pack file is checked exactly as before (no bundle line).
  it('a plain pack file has no bundle line', () => {
    const result = run('saltwick-island.pack.json', JSON.stringify(pack));
    expect(result.out).toContain('Saltwick Island');
    expect(result.out).not.toContain('Bundle:');
    expect(result.code).toBe(0);
  });

  // Purpose: a .zip that is no bundle can't be imported, said in the app's own words.
  it("a .zip with no pack file can't be imported", async () => {
    const result = run('pictures.zip', await makeZip({ 'images/map-harbour.png': 'a harbour' }));
    expect(result.out).toContain("Can't be imported: That .zip holds no pack file");
    expect(result.code).toBe(1);
  });

  // Purpose: a .zip a real tool made (Python's zipfile) reads the same as the ones these tests make.
  it('reads a bundle another tool made', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-bundle-'));
    const made = join(dir, 'made.zip');
    writeFileSync(join(dir, 'p.json'), JSON.stringify(pack));
    try {
      execFileSync('python3', ['-c', 'import sys, zipfile\nz = zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED)\nz.write(sys.argv[2], "saltwick/saltwick.pack.json")\nz.writestr("saltwick/images/map-harbour.png", "a harbour")\nz.close()', made, join(dir, 'p.json')]);
    } catch {
      rmSync(dir, { recursive: true, force: true });
      return; // No Python on this machine: the tests above stand.
    }
    const out = spawnSync('node', ['scripts/check-pack.mjs', made], { encoding: 'utf8' });
    rmSync(dir, { recursive: true, force: true });
    expect(out.stdout).toContain('Bundle: the pack file is saltwick.pack.json; pictures for 1 of 2 maps.');
    expect(out.status).toBe(0);
  });
});
