// @vitest-environment jsdom
// The sweep's first rule (plan m5b-players-screens-standard E; 06, "never a disabled button"): every blocked action
// stays tappable and explains why in a Sheet; a busy button ignores a second tap instead of greying out.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OptionalRules } from '../app/OptionalRules.tsx';
import type { OptionalRule } from '../modules/library/options.ts';
import { installBusyGuard } from './busyGuard.ts';
import { DestinationList } from './parts.tsx';
import { SortableList } from './SortableList.tsx';

afterEach(() => cleanup());

// Every source file and stylesheet in the app, read from disk (tests left out: they may quote what they check).
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const code = Object.keys(import.meta.glob(['/src/**/*.{ts,tsx,css}', '!/src/**/*.test.{ts,tsx}', '!/src/testing/**'])).map(
  (p) => [p, fs.readFileSync(`.${p}`, 'utf8')] as const,
);
/** A file's text with its comments taken out (a comment may say "never disabled"). */
const uncommented = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('no disabled buttons anywhere', () => {
  it('no control in the app is given `disabled` or `aria-disabled`, and no style greys out a disabled one', () => {
    const found = code.flatMap(([path, text]) =>
      uncommented(text)
        .split(/\r?\n/)
        .filter((line) => /\bdisabled=|\bdisabled>|\bdisabled\s*$|aria-disabled|:disabled\b/.test(line))
        .map((line) => `${path}: ${line.trim()}`),
    );
    expect(found).toEqual([]);
  });

  it('a busy button ignores a tap: its handler does not run and its form is not sent', () => {
    installBusyGuard();
    const tapped = vi.fn();
    const sent = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={sent}>
        <button type="button" aria-busy="true" onClick={tapped}>
          Approve
        </button>
        <button type="submit" aria-busy="true">
          Save
        </button>
        <button type="button" aria-busy="false" onClick={tapped}>
          Cancel
        </button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(tapped).not.toHaveBeenCalled();
    expect(sent).not.toHaveBeenCalled();
    // Not busy: it acts.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(tapped).toHaveBeenCalledOnce();
  });

  it('a locked optional rule: its choices stay tappable, and a tap says why in a sheet instead of changing it', async () => {
    const lantern: OptionalRule = {
      id: 'lantern-oil',
      name: 'Lantern oil',
      choices: [
        { id: 'counted', name: 'Counted', notes: '' },
        { id: 'free', name: 'Free', notes: '' },
      ],
      defaultChoice: 'counted',
      changeLater: 'lock',
      notes: '',
      category: '',
      source: '',
      ruleKey: '',
      extends: '',
    };
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OptionalRules options={[lantern]} choices={{ 'lantern-oil': 'counted' }} attaching={false} onChange={onChange} />);
    const free = screen.getByRole('button', { name: 'Free' });
    expect(free.hasAttribute('disabled')).toBe(false);
    await user.click(free);
    const sheet = await screen.findByRole('dialog', { name: 'Lantern oil is locked' });
    expect(sheet.textContent).toContain("Can't change once the campaign starts. It stays Counted.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a list that can\'t be reordered now still takes the keyboard, and a move asks the screen to say why', () => {
    const onMove = vi.fn();
    const onBlocked = vi.fn();
    render(
      <SortableList
        items={[
          { key: 'a', label: 'Wren' },
          { key: 'b', label: 'Bram' },
        ]}
        label="Marching order"
        blocked
        onBlocked={onBlocked}
        onMove={onMove}
        render={(item) => <span>{item.label}</span>}
      />,
    );
    const handle = screen.getByRole('slider', { name: 'Move Wren' });
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onMove).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledOnce();
  });

  // Purpose (review on #561): while a list can't be reordered (a field open for editing), a long press on a control
  // inside a row (the open editor's field, Save) belongs to that control: no "can't move" sheet. A hold on the row
  // itself still explains.
  it('while blocked, holding a field or a button inside a row says nothing; holding the row explains', () => {
    vi.useFakeTimers();
    try {
      const onBlocked = vi.fn();
      render(
        <SortableList
          items={[{ key: 'a', label: 'Wren' }]}
          label="Character fields"
          blocked
          onBlocked={onBlocked}
          onMove={() => undefined}
          render={() => (
            <div>
              <span>Muscle</span>
              <input aria-label="Label" />
              <button type="button">Save</button>
            </div>
          )}
        />,
      );
      const hold = (el: Element) => {
        fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
        vi.advanceTimersByTime(1000);
        fireEvent.pointerUp(el, { button: 0, pointerId: 1 });
      };
      hold(screen.getByLabelText('Label'));
      hold(screen.getByRole('button', { name: 'Save' }));
      expect(onBlocked).not.toHaveBeenCalled();
      hold(screen.getByText('Muscle'));
      expect(onBlocked).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  // Purpose (Design, ⚑ 6 on #561): a blocked destination is marked by the warning sign, never a plain ▲.
  it('a blocked destination shows the warning sign and its words, and no ▲', () => {
    render(<DestinationList label="Put in" destinations={[{ id: 'sack', name: 'Sack', group: 'Containers', blocked: 'Full' }]} selected={null} onSelect={() => undefined} onBlocked={() => undefined} />);
    const row = screen.getByRole('radio', { name: /Sack/ });
    expect(row.querySelector('.warning-sign')).not.toBeNull();
    expect(row.textContent).toContain('Full');
    expect(row.textContent).not.toContain('▲');
  });
});
