// @vitest-environment jsdom
// The campaign's setting rules, reordered by a real drag (fix-pack-order-drag; Francis on the live app: "I could
// reposition but it snapped back"). A hold of half a second lifts a row, the finger moves, the finger lets go; the
// rows are tall and of unequal heights, as packs are. Invented packs only. Each test carries its own helpers.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import type { Db } from '../core/supabase.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

it('a pack dragged up a place shows there at once, before the save is done; then it is saved, logged and stays there', async () => {
  // The campaign's homebrew on top, then Fen Rules (a tall row), then River Rules (a short one).
  const world = createFakeDb();
  forgetCampaignSetting();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
  for (const [id, name, priority] of [['pack-river', 'River Rules', 1], ['pack-fen', 'Fen Rules', 2]] as const) {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: id, kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden' } });
    world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: {}, overrides: {}, priority });
  }
  world.signInAs(gm);
  // A slow connection: saving a pack's place waits until `release()`.
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const db = new Proxy(world.db, {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver);
      return (table: string) => {
        const query = target.from(table as never);
        if (table !== 'campaign_packs') return query;
        return new Proxy(query, {
          get(q, p, r) {
            if (p !== 'update') {
              const value = Reflect.get(q, p, r);
              return typeof value === 'function' ? value.bind(q) : value;
            }
            return (values: never) => ({ eq: (column: never, id: never) => ({ select: async (columns: never) => (await gate, q.update(values).eq(column, id).select(columns)) }) });
          },
        });
      };
    },
  }) as Db;
  const packNames = () => [...document.querySelectorAll('.setting-rules__pack .setting-rules__name')].map((n) => n.textContent);
  const priorities = () => Object.fromEntries(world.tables.campaign_packs.map((cp) => [cp.id, cp.priority]));
  const reorders = () => new Set(world.tables.events.filter((e) => e.type === 'rules.reorder').map((e) => e.request_id)).size;
  try {
    const user = userEvent.setup();
    render(<Root db={db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByText('Press and hold a row to move it.');
    expect(packNames()).toEqual(['The Ash Barrows homebrew', 'Fen Rules', 'River Rules']);
    // Each row's height on a tablet, wherever it stands now: the homebrew 120 px, Fen Rules 320, River Rules 80.
    const heights: Record<string, number> = { 'The Ash Barrows homebrew': 120, 'Fen Rules': 320, 'River Rules': 80 };
    const list = screen.getByRole('list', { name: 'Setting rules, top first' });
    const rows = () => [...list.querySelectorAll(':scope > li')] as HTMLElement[];
    const heightOf = (row: Element) => heights[row.querySelector('.setting-rules__name')?.textContent ?? ''] ?? 60;
    for (const each of rows()) {
      each.getBoundingClientRect = () => {
        const above = rows().slice(0, rows().indexOf(each));
        const top = above.reduce((sum, other) => sum + heightOf(other), 0);
        const height = heightOf(each);
        return { top, bottom: top + height, height, left: 0, right: 768, width: 768, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      };
    }
    const row = (name: string) => rows().find((each) => each.querySelector('.setting-rules__name')?.textContent === name)!;
    // A real hold of River Rules (its middle at 480), half a second, then the finger past Fen Rules' middle (280).
    fireEvent.pointerDown(row('River Rules'), { clientX: 300, clientY: 480, pointerId: 1, button: 0 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 520)));
    for (const y of [425, 370, 315, 260]) fireEvent.pointerMove(row('River Rules'), { clientX: 300, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(row('River Rules'), { clientX: 300, clientY: 260, pointerId: 1 });
    expect(packNames()).toEqual(['The Ash Barrows homebrew', 'River Rules', 'Fen Rules']);
    await act(async () => release());
    await waitFor(() => expect(priorities()).toEqual({ 'link-home': 3, 'link-pack-river': 2, 'link-pack-fen': 1 }));
    expect(reorders()).toBe(1);
    await waitFor(() => expect(packNames()).toEqual(['The Ash Barrows homebrew', 'River Rules', 'Fen Rules']));
  } finally {
    release();
    cleanup();
    forgetCampaignSetting();
  }
});

it('a tall pack, held near its foot, lands below a short one once the finger is past the short one’s middle', async () => {
  // The campaign's homebrew on top, then Fen Rules (a tall row), then River Rules (a short one).
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
  const world = createFakeDb();
  forgetCampaignSetting();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
  for (const [id, name, priority] of [['pack-river', 'River Rules', 1], ['pack-fen', 'Fen Rules', 2]] as const) {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: id, kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden' } });
    world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: {}, overrides: {}, priority });
  }
  world.signInAs(gm);
  const packNames = () => [...document.querySelectorAll('.setting-rules__pack .setting-rules__name')].map((n) => n.textContent);
  const priorities = () => Object.fromEntries(world.tables.campaign_packs.map((cp) => [cp.id, cp.priority]));
  try {
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByText('Press and hold a row to move it.');
    expect(packNames()).toEqual(['The Ash Barrows homebrew', 'Fen Rules', 'River Rules']);
    // Each row's height on a tablet, wherever it stands now: the homebrew 120 px, Fen Rules 320, River Rules 80.
    const heights: Record<string, number> = { 'The Ash Barrows homebrew': 120, 'Fen Rules': 320, 'River Rules': 80 };
    const list = screen.getByRole('list', { name: 'Setting rules, top first' });
    const rows = () => [...list.querySelectorAll(':scope > li')] as HTMLElement[];
    const heightOf = (row: Element) => heights[row.querySelector('.setting-rules__name')?.textContent ?? ''] ?? 60;
    for (const each of rows()) {
      each.getBoundingClientRect = () => {
        const above = rows().slice(0, rows().indexOf(each));
        const top = above.reduce((sum, other) => sum + heightOf(other), 0);
        const height = heightOf(each);
        return { top, bottom: top + height, height, left: 0, right: 768, width: 768, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      };
    }
    const row = (name: string) => rows().find((each) => each.querySelector('.setting-rules__name')?.textContent === name)!;
    // Fen Rules spans 120 to 440; River Rules 440 to 520, its middle at 480. Held at 430, let go at 495.
    fireEvent.pointerDown(row('Fen Rules'), { clientX: 300, clientY: 430, pointerId: 1, button: 0 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 520)));
    for (const y of [446, 462, 479, 495]) fireEvent.pointerMove(row('Fen Rules'), { clientX: 300, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(row('Fen Rules'), { clientX: 300, clientY: 495, pointerId: 1 });
    await waitFor(() => expect(priorities()).toEqual({ 'link-home': 3, 'link-pack-river': 2, 'link-pack-fen': 1 }));
    await waitFor(() => expect(packNames()).toEqual(['The Ash Barrows homebrew', 'River Rules', 'Fen Rules']));
  } finally {
    cleanup();
    forgetCampaignSetting();
  }
});

it('a setting pack dragged above the campaign’s homebrew is refused out loud, and nothing moves', async () => {
  // The campaign's homebrew on top, then Fen Rules (a tall row), then River Rules (a short one).
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
  const world = createFakeDb();
  forgetCampaignSetting();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
  for (const [id, name, priority] of [['pack-river', 'River Rules', 1], ['pack-fen', 'Fen Rules', 2]] as const) {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: id, kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden' } });
    world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: {}, overrides: {}, priority });
  }
  world.signInAs(gm);
  const packNames = () => [...document.querySelectorAll('.setting-rules__pack .setting-rules__name')].map((n) => n.textContent);
  const priorities = () => Object.fromEntries(world.tables.campaign_packs.map((cp) => [cp.id, cp.priority]));
  const reorders = () => new Set(world.tables.events.filter((e) => e.type === 'rules.reorder').map((e) => e.request_id)).size;
  try {
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByText('Press and hold a row to move it.');
    expect(packNames()).toEqual(['The Ash Barrows homebrew', 'Fen Rules', 'River Rules']);
    // Each row's height on a tablet, wherever it stands now: the homebrew 120 px, Fen Rules 320, River Rules 80.
    const heights: Record<string, number> = { 'The Ash Barrows homebrew': 120, 'Fen Rules': 320, 'River Rules': 80 };
    const list = screen.getByRole('list', { name: 'Setting rules, top first' });
    const rows = () => [...list.querySelectorAll(':scope > li')] as HTMLElement[];
    const heightOf = (row: Element) => heights[row.querySelector('.setting-rules__name')?.textContent ?? ''] ?? 60;
    for (const each of rows()) {
      each.getBoundingClientRect = () => {
        const above = rows().slice(0, rows().indexOf(each));
        const top = above.reduce((sum, other) => sum + heightOf(other), 0);
        const height = heightOf(each);
        return { top, bottom: top + height, height, left: 0, right: 768, width: 768, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      };
    }
    const row = (name: string) => rows().find((each) => each.querySelector('.setting-rules__name')?.textContent === name)!;
    // Fen Rules held at its middle (280) and taken to the top of the list, above the homebrew.
    fireEvent.pointerDown(row('Fen Rules'), { clientX: 300, clientY: 280, pointerId: 1, button: 0 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 520)));
    for (const y of [215, 150, 85, 20]) fireEvent.pointerMove(row('Fen Rules'), { clientX: 300, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(row('Fen Rules'), { clientX: 300, clientY: 20, pointerId: 1 });
    const popUp = await screen.findByRole('dialog', { name: 'Can’t move it there' });
    expect(within(popUp).getByText('Your campaign’s homebrew always sits above the setting rules.')).toBeTruthy();
    expect(packNames()).toEqual(['The Ash Barrows homebrew', 'Fen Rules', 'River Rules']);
    expect(priorities()).toEqual({ 'link-home': 3, 'link-pack-fen': 2, 'link-pack-river': 1 });
    expect(reorders()).toBe(0);
  } finally {
    cleanup();
    forgetCampaignSetting();
  }
});

it('a hold on another row while a move is still saving says so, rather than doing nothing', async () => {
  // The campaign's homebrew on top, then Fen Rules (a tall row), then River Rules (a short one).
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
  const world = createFakeDb();
  forgetCampaignSetting();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
  for (const [id, name, priority] of [['pack-river', 'River Rules', 1], ['pack-fen', 'Fen Rules', 2]] as const) {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: id, kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden' } });
    world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: {}, overrides: {}, priority });
  }
  world.signInAs(gm);
  // A slow connection: saving a pack's place waits until `release()`.
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const db = new Proxy(world.db, {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver);
      return (table: string) => {
        const query = target.from(table as never);
        if (table !== 'campaign_packs') return query;
        return new Proxy(query, {
          get(q, p, r) {
            if (p !== 'update') {
              const value = Reflect.get(q, p, r);
              return typeof value === 'function' ? value.bind(q) : value;
            }
            return (values: never) => ({ eq: (column: never, id: never) => ({ select: async (columns: never) => (await gate, q.update(values).eq(column, id).select(columns)) }) });
          },
        });
      };
    },
  }) as Db;
  const reorders = () => new Set(world.tables.events.filter((e) => e.type === 'rules.reorder').map((e) => e.request_id)).size;
  try {
    const user = userEvent.setup();
    render(<Root db={db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByText('Press and hold a row to move it.');
    // Each row's height on a tablet, wherever it stands now: the homebrew 120 px, Fen Rules 320, River Rules 80.
    const heights: Record<string, number> = { 'The Ash Barrows homebrew': 120, 'Fen Rules': 320, 'River Rules': 80 };
    const list = screen.getByRole('list', { name: 'Setting rules, top first' });
    const rows = () => [...list.querySelectorAll(':scope > li')] as HTMLElement[];
    const heightOf = (row: Element) => heights[row.querySelector('.setting-rules__name')?.textContent ?? ''] ?? 60;
    for (const each of rows()) {
      each.getBoundingClientRect = () => {
        const above = rows().slice(0, rows().indexOf(each));
        const top = above.reduce((sum, other) => sum + heightOf(other), 0);
        const height = heightOf(each);
        return { top, bottom: top + height, height, left: 0, right: 768, width: 768, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      };
    }
    const row = (name: string) => rows().find((each) => each.querySelector('.setting-rules__name')?.textContent === name)!;
    // River Rules dragged up a place; its save waits.
    fireEvent.pointerDown(row('River Rules'), { clientX: 300, clientY: 480, pointerId: 1, button: 0 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 520)));
    for (const y of [425, 370, 315, 260]) fireEvent.pointerMove(row('River Rules'), { clientX: 300, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(row('River Rules'), { clientX: 300, clientY: 260, pointerId: 1 });
    // Meanwhile a hold on Fen Rules.
    fireEvent.pointerDown(row('Fen Rules'), { clientX: 300, clientY: 300, pointerId: 2, button: 0 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 520)));
    const popUp = await screen.findByRole('dialog', { name: 'Still saving' });
    expect(within(popUp).getByText('The last change is still saving. Move it again in a moment.')).toBeTruthy();
    await act(async () => release());
    await waitFor(() => expect(reorders()).toBe(1));
  } finally {
    release();
    cleanup();
    forgetCampaignSetting();
  }
});
