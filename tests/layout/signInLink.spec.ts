// Sign-in from the link in the email, in WebKit (P24, ruled A, 2026-11-07). Purpose:
//   A link opened from Mail on an iPhone lands in a browser that shares no cookies or storage with the tab that asked
//   for the code. Opened in a brand-new browser context, the address's code is read, the email arrives whole (a "+"
//   kept, raw or percent-encoded) and sign-in finishes to Your campaigns; a wrong code stays filled in, with a clear
//   error beside it.
// Against the stand-in database of the layout checks (layout.html, signed out), whose accepted code is FAKE_EMAIL_CODE.
import { expect, test, type Browser, type Page } from '@playwright/test';
// The stand-in's accepted code (FAKE_EMAIL_CODE in src/testing/fakeDb.ts), copied: the spec stays clear of app modules.
const FAKE_EMAIL_CODE = '246810';

const EMAIL = 'wren+table@lantern.example';

/** The address opened in a fresh context: no storage state, nothing shared with any other tab. */
async function openLink(browser: Browser, query: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`/layout.html?${query}`);
  return page;
}

/** Signs in through the name step (a new person) to Your campaigns, checking the name offered is the whole local part. */
async function finishes(page: Page) {
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible();
  // The name offered is the email's local part: "wren table" would mean the "+" was lost on the way.
  await expect(page.getByLabel('Your name')).toHaveValue('wren+table');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Your campaigns' })).toBeVisible();
  // The code left the address, so a reload never sends it again.
  expect(new URL(page.url()).search).not.toContain('code=');
}

test.describe('sign-in from the email link, in a fresh browser', () => {
  test('a raw "+" in the email: the code is read and sign-in finishes', async ({ browser }) => {
    const page = await openLink(browser, `code=${FAKE_EMAIL_CODE}&email=${EMAIL}`);
    await finishes(page);
    await page.context().close();
  });

  test('a percent-encoded email: the same', async ({ browser }) => {
    const page = await openLink(browser, `code=${FAKE_EMAIL_CODE}&email=${encodeURIComponent(EMAIL)}`);
    await finishes(page);
    await page.context().close();
  });

  test('a wrong code stays filled in, with a clear error, and the email whole', async ({ browser }) => {
    const wrong = '135790';
    const page = await openLink(browser, `code=${wrong}&email=${encodeURIComponent(EMAIL)}`);
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.locator('.auth__email')).toHaveText(EMAIL);
    await expect(page.getByLabel('Sign-in code')).toHaveValue(wrong);
    await expect(page.getByRole('alert')).toContainText('The code from your email is still below');
    await page.context().close();
  });
});
