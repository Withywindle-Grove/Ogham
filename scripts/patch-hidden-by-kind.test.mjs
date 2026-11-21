// The app's list of fields a kind hides from players by name (HIDDEN_BY_KIND, src/modules/library/patchPath.ts; pf-19a)
// against the database's own, `private.hidden_keys` in its newest migration: the two must agree, so a patch never sets
// a field the database would hide for that kind.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HIDDEN_BY_KIND } from '../src/modules/library/patchPath.ts';

describe('the fields a kind hides by name', () => {
  // Purpose: every kind the newest hidden_keys hides fields of by name (a rules set's sections aside) lists the same
  // names in the app, and the app lists no other kind.
  it('match the database’s private.hidden_keys', () => {
    const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
    const newest = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => /function private\.hidden_keys\(/.test(readFileSync(join(dir, f), 'utf8'))).pop();
    expect(newest).toBeDefined();
    const sql = readFileSync(join(dir, newest), 'utf8');
    const body = sql.slice(sql.search(/function private\.hidden_keys\(/));
    const definition = body.slice(0, body.indexOf('$$;', body.indexOf('$$') + 2));
    const byKind = {};
    for (const m of definition.matchAll(/kind = '(\w+)'[^\n]*\n\s*where e\.key in \(([^)]*)\)/g)) {
      if (m[1] === 'rulesSet') continue;
      byKind[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((k) => k[1]).sort();
    }
    expect(byKind).toEqual(Object.fromEntries(Object.entries(HIDDEN_BY_KIND).map(([k, v]) => [k, [...v].sort()])));
    expect(byKind.patron).toEqual(['cult', 'statBlockId']);
  });
});
