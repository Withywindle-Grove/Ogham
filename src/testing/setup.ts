// Before every app test (vite.config.ts `test.setupFiles`). Guided creation keeps each pick on the device as it's
// made (after-test A12), so a test that walks part-way would leave its picks for the next test in the file, which
// would then open on "Continue where you left off". Each test starts with nothing kept.
import { configure } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { forgetAllKept } from '../app/keptCreation.ts';

// findBy… and waitFor wait up to 5 s, not Testing Library's 1 s: on a loaded CI runner the first render of a
// screen can take longer than 1 s, which failed tests that pass alone (2026-11-09: playersStandard, whoTheyAre).
// A test that passes is no slower; only a failing wait takes longer to report.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  if (typeof localStorage !== 'undefined') forgetAllKept();
});
