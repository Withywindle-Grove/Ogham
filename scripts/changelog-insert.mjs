// Puts a drafted entry at the top of CHANGELOG.md (newest first), just above the newest milestone's heading.
// Used by the CHANGELOG draft workflow (.github/workflows/changelog-draft.yml); Francis edits the draft on its branch.
// Usage: node scripts/changelog-insert.mjs CHANGELOG.md <entry file>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** The changelog text with the entry inserted before the first "## " heading (or at the end if there is none). */
export function insertEntry(changelog, entry) {
  const clean = entry.replace(/\r\n/g, '\n').trim();
  if (!clean.startsWith('## ')) throw new Error('The drafted entry must start with a "## " heading.');
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.startsWith('## '));
  if (first === -1) return `${changelog.replace(/\s*$/, '')}\n\n${clean}\n`;
  return [...lines.slice(0, first), ...clean.split('\n'), '', ...lines.slice(first)].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [changelogPath, entryPath] = process.argv.slice(2);
  if (!changelogPath || !entryPath) {
    console.error('Usage: node scripts/changelog-insert.mjs CHANGELOG.md <entry file>');
    process.exit(1);
  }
  const updated = insertEntry(readFileSync(changelogPath, 'utf8'), readFileSync(entryPath, 'utf8'));
  writeFileSync(changelogPath, updated);
}
