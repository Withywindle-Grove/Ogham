// The private setting packs for the local-only tests (hard rule 2: packs are never committed, so on GitHub these
// tests are skipped). Each pack's newest build candidate is used, else its own pack file. Holds no game content:
// callers pass what their import.meta.glob found.
//   Candidates sit in packs/<folder>/build/ as <slug>-candidate-<version>.pack.json (older ones are plain
// candidate-<version>.pack.json; both are read). Live packs are packs/<folder>/<slug>-<version>.pack.json.
// Callers glob packs/*/build/*candidate-*.pack.json (and, for live packs, packs/*/*.pack.json).
// Nothing here depends on a folder or file name: packs are told apart by their meta.id and listed in its order.

/** A candidate's version as numbers ("…candidate-0.6.1.pack.json" gives [0, 6, 1]). */
export const versionOf = (path: string) => (/candidate-([\d.]+)\.pack\.json$/.exec(path)?.[1] ?? '0').split('.').map(Number);

/** A pack's meta.id from its raw text, or the path when it has none (or doesn't read), so it still stands alone. */
export function packIdOf(path: string, raw: string): string {
  try {
    const meta: unknown = (JSON.parse(raw) as { meta?: unknown }).meta;
    const id = typeof meta === 'object' && meta !== null ? (meta as { id?: unknown }).id : undefined;
    return typeof id === 'string' && id !== '' ? id : path;
  } catch {
    return path;
  }
}

const newer = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
};

/**
 * The files to test, sorted by meta.id: for each pack its newest build candidate, else (when `packFiles` is given)
 * its own pack file. Each comes with its meta.id and raw text.
 */
export function newestPerPack(candidates: Record<string, string>, packFiles: Record<string, string> = {}): { id: string; path: string; raw: string }[] {
  const chosen = new Map<string, string>();
  for (const [path, raw] of Object.entries(candidates)) {
    const id = packIdOf(path, raw);
    const held = chosen.get(id);
    if (!held || newer(versionOf(path), versionOf(held))) chosen.set(id, path);
  }
  for (const [path, raw] of Object.entries(packFiles)) {
    const id = packIdOf(path, raw);
    if (!chosen.has(id)) chosen.set(id, path);
  }
  const all = { ...packFiles, ...candidates };
  return [...chosen.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, path]) => ({ id, path, raw: all[path]! }));
}
