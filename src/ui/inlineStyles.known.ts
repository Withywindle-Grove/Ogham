// Check 5's known list (hard rule 7; docs/specs/hard-rule-and-size-checks.md, "Known breaks"): the old inline styles
// with a raw value, one entry per file and property, each with its reason. The test in designSystem.test.ts fails on
// a break not listed here and on an entry that no longer breaks, so this list only gets shorter. It was empty when
// the check was switched on (2026-11-27): no component wrote a raw value in an inline style.
import type { KnownInlineBreak } from './rawValues.ts';

export const KNOWN_INLINE_BREAKS: KnownInlineBreak[] = [];
