// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { registerUrgentSource, type UrgentItem } from '../core/urgent.ts';
import { UrgentStrip } from './UrgentStrip.tsx';

afterEach(cleanup);

// A test-only source (never registered in the app): one item until it's dealt with.
function sampleSource() {
  let dealtWith = false;
  const unregister = registerUrgentSource({
    id: 'test-lantern',
    items: async ({ characterId }): Promise<UrgentItem[]> =>
      dealtWith
        ? []
        : [{ key: `lantern-${characterId}`, section: 'light', text: 'Hooded lantern: 1 turn left', action: { label: 'OK', run: () => void (dealtWith = true) } }],
  });
  return unregister;
}

describe('the Urgent strip (framework, M4)', () => {
  it('shows nothing without sources', async () => {
    render(<UrgentStrip characterId="actor-wren" campaignId="campaign-1" hiddenSections={[]} />);
    expect(screen.queryByRole('status', { name: 'Urgent' })).toBeNull();
  });

  it("shows a source's item even when its section is hidden, until it's dealt with", async () => {
    const unregister = sampleSource();
    const user = userEvent.setup();
    render(<UrgentStrip characterId="actor-wren" campaignId="campaign-1" hiddenSections={['light']} />);
    expect(await screen.findByText('Hooded lantern: 1 turn left')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Hooded lantern: 1 turn left')).toBeNull();
    unregister();
  });
});
