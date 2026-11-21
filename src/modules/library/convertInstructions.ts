// "Convert with an AI" (docs/07-content-packs.md, Appendix): the instructions a person copies into an AI chat
// along with their own book, so it writes a pack the app can import. Built from the spec itself, so the
// instructions never drift from the format: the appendix's quoted text, then the format sections.

const PLACEHOLDER = /^\[The JSON format section of this document is appended here\.\]$/;

/** The instructions from the spec's text; null if the spec doesn't have the expected sections. */
export function convertInstructions(spec: string): string | null {
  const appendixAt = spec.indexOf('## Appendix: instructions shown in the app');
  const formatAt = spec.indexOf('## JSON format (version 1)');
  const formatEnd = spec.indexOf('## Homebrew', formatAt);
  if (appendixAt === -1 || formatAt === -1 || formatEnd === -1) return null;
  const asked = spec
    .slice(appendixAt)
    .split('\n')
    .filter((line) => line.startsWith('>'))
    .map((line) => line.replace(/^>\s?/, ''))
    .filter((line) => !PLACEHOLDER.test(line.trim()));
  if (asked.length === 0) return null;
  return `${asked.join('\n')}\n\n${spec.slice(formatAt, formatEnd).trim()}\n`;
}
