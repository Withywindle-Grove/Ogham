// "About this file": what a pack's file says about itself beyond what the app uses (author, licence…), in
// plain words for a GM. Known keys get friendly labels; anything only a converter tool cares about is
// summed up in one line instead of shown raw.

import { BRAND } from '../../brand.ts';

export interface AboutLine {
  label: string;
  text: string;
}

const LABELS: Record<string, string> = {
  shortName: 'Short name',
  author: 'Made by',
  authors: 'Made by',
  built: 'Made on',
  created: 'Made on',
  updated: 'Last changed',
  licence: 'Licence',
  license: 'Licence',
  openContent: 'Open content',
  url: 'Website',
  website: 'Website',
  contact: 'Contact',
  description: 'About',
  language: 'Language',
};

/** Keys meant for the people and tools that make packs, not for the table. */
const FOR_MAKERS = ['proposedExtensions'];

/** "openContent" → "Open content", "game_system" → "Game system". */
function words(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function plain(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const simple = value.filter((item) => typeof item === 'string' || typeof item === 'number').map(String);
    if (simple.length === value.length && simple.length > 0 && simple.length <= 5) return simple.join(', ');
    return value.length === 0 ? null : `${value.length} items`;
  }
  return null;
}

export function aboutFile(extra: Record<string, unknown>): AboutLine[] {
  const lines: AboutLine[] = [];
  let forMakers = 0;
  for (const [key, value] of Object.entries(extra)) {
    if (FOR_MAKERS.includes(key)) {
      forMakers += Array.isArray(value) ? value.length : 1;
      continue;
    }
    if (key === 'private' && typeof value === 'boolean') {
      lines.push({ label: 'Private', text: value ? 'Yes: keep it to your own table' : 'No' });
      continue;
    }
    const text = plain(value);
    if (text === null) {
      forMakers += 1;
      continue;
    }
    lines.push({ label: LABELS[key] ?? words(key), text });
  }
  // Friendly labels first, in the order above, then the rest as the file has them.
  const order = Object.values(LABELS);
  lines.sort((a, b) => (order.indexOf(a.label) + 1 || 99) - (order.indexOf(b.label) + 1 || 99));
  if (forMakers > 0) {
    lines.push({
      label: 'For pack makers',
      text: `The file also has ${forMakers === 1 ? 'one note' : `${forMakers} notes`} for whoever builds packs (like details ${BRAND.appName} doesn't read yet). They're kept, and change nothing at the table.`,
    });
  }
  return lines;
}
