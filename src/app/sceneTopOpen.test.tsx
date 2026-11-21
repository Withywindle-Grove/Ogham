// @vitest-environment jsdom
// B12b (Francis 2026-11-19, "Yes, remember it"; d5-10): the Scene top's fold is remembered on the device. Open the
// first time on every device, then as the GM left it; one memory for the device; nothing sent to the server.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSceneTopOpen, setSceneTopOpen, useSceneTopOpen } from './sceneTopOpen.ts';

const KEY = 'grimoire.sceneTopOpen';

beforeEach(() => localStorage.removeItem(KEY));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(KEY);
});

describe("the Scene top's fold on this device (B12b)", () => {
  // Purpose: on a device that has kept nothing, the top starts open (d5-10: on every device, a phone too).
  it('starts open on a device that has kept nothing', () => {
    expect(getSceneTopOpen()).toBe(true);
    const { result } = renderHook(() => useSceneTopOpen());
    expect(result.current[0]).toBe(true);
  });

  // Purpose: folded, then the Scene left (the hook unmounted) and opened again, the top is still folded; opened again,
  // it stays open the next time.
  it('opens as it was left: folded stays folded, opened stays open', () => {
    const first = renderHook(() => useSceneTopOpen());
    act(() => first.result.current[1](false));
    expect(first.result.current[0]).toBe(false);
    first.unmount();
    const second = renderHook(() => useSceneTopOpen());
    expect(second.result.current[0]).toBe(false);
    act(() => second.result.current[1](true));
    second.unmount();
    expect(renderHook(() => useSceneTopOpen()).result.current[0]).toBe(true);
  });

  // Purpose: one memory for the device, not one per campaign: a single key, read and set without any campaign.
  it('keeps one memory for the device', () => {
    setSceneTopOpen(false);
    expect(localStorage.getItem(KEY)).toBe('folded');
    setSceneTopOpen(true);
    expect(localStorage.getItem(KEY)).toBe('open');
    expect(Object.keys(localStorage).filter((k) => k.startsWith('grimoire.sceneTop'))).toEqual([KEY]);
  });

  // Purpose: a word the app did not write reads open, as nothing kept does.
  it('reads anything but "folded" as open', () => {
    localStorage.setItem(KEY, 'something else');
    expect(getSceneTopOpen()).toBe(true);
  });

  // Purpose: with the browser's storage blocked (private browsing) the top starts open, and the fold still works while
  // the Scene is open, with no error.
  it('starts open and still folds when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getSceneTopOpen()).toBe(true);
    const { result } = renderHook(() => useSceneTopOpen());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });

  // Purpose: folding and opening the top sends nothing to the server: no network request is made.
  it('sends nothing to the server', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('no network')));
    const { result } = renderHook(() => useSceneTopOpen());
    act(() => result.current[1](false));
    act(() => result.current[1](true));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
