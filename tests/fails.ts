// Playwright's `test`, with `test.fails` as another name for its `test.fail` (a test that must fail). On a fix- branch
// the failing test comes first, marked `.fails` (bq-6), and the guard (scripts/guard-tests.mjs) knows that mark by
// Vitest's name; this lets a layout check be written the same way, then the fix removes `.fails` alone.
import { test as base } from '@playwright/test';

const own = base.extend({});

export const test = Object.assign(own, { fails: own.fail });
