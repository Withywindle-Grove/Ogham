// Test setup (vite.config.ts, test.setupFiles): before a file's tests run, load every lazy screen its imports made,
// so a screen shows at once after a tap, as in the app, where they're fetched in the background (lazyScreen.tsx).
import { beforeAll } from 'vitest';

beforeAll(async () => {
  const { preloadEveryScreen } = await import('../app/lazyScreen.tsx');
  await preloadEveryScreen();
});
