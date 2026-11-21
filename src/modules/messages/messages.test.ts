// Messaging (M5b g4), pure:
//   a row becomes a message (its picture, if any, as one object);
//   the unread count counts only what was sent to this person and not read yet (the GM's own messages never count
//   for the GM, a player's own never for the player);
//   opening a thread marks the plain unread ones read, never a disappearing one (that waits for Close);
//   the GM's list has one thread per character in play, the newest-written first, then by name;
//   the list's line is the text's first words, or the picture's name.
import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import { messageLine, threadsByCharacter, toMarkRead, toMessage, unreadCount, type Message } from './messages.ts';

const gm: CurrentUser = { id: 'u-gm', roles: { c: 'gm' } };
const tam: CurrentUser = { id: 'u-tam', roles: { c: 'player' } };

const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id,
  campaignId: 'c',
  actorId: 'wren',
  playerUserId: 'u-tam',
  fromGm: true,
  senderUserId: 'u-gm',
  body: `Text ${id}`,
  attachment: null,
  disappears: false,
  readAt: null,
  sentAt: `2026-11-01T10:00:0${id.length}Z`,
  ...over,
});

describe('messages', () => {
  it('a row becomes a message, its picture as one object or null', () => {
    const row = { id: 'm', campaign_id: 'c', actor_id: 'wren', player_user_id: 'u-tam', from_gm: true, sender_user_id: 'u-gm', body: 'Look up.', disappears: true, read_at: null, created_at: 't' };
    expect(toMessage(row)).toMatchObject({ id: 'm', fromGm: true, body: 'Look up.', disappears: true, readAt: null, attachment: null });
    expect(toMessage({ ...row, attachment_name: 'ledger.jpg', attachment_type: 'image/jpeg', attachment_size: 1200 }).attachment).toEqual({ name: 'ledger.jpg', type: 'image/jpeg', size: 1200 });
  });

  it('the unread count is what was sent to me and not read: the GM counts players’ messages, a player the GM’s', () => {
    const messages = [msg('a'), msg('bb', { readAt: 't' }), msg('ccc', { fromGm: false, senderUserId: 'u-tam' }), msg('dddd', { fromGm: false, senderUserId: 'u-tam', readAt: 't' })];
    expect(unreadCount(messages, tam)).toBe(1);
    expect(unreadCount(messages, gm)).toBe(1);
    expect(unreadCount(messages, { id: 'u-sol', roles: { c: 'player' } })).toBe(0);
  });

  it('opening the thread marks the plain unread ones read, never a disappearing one', () => {
    const messages = [msg('a'), msg('bb', { disappears: true }), msg('ccc', { readAt: 't' }), msg('dddd', { fromGm: false })];
    expect(toMarkRead(messages, tam)).toEqual(['a']);
    expect(toMarkRead(messages, gm)).toEqual(['dddd']);
  });

  it('the GM’s list has one thread per character, the newest-written first, then by name, each with its unread count', () => {
    const characters = [
      { id: 'wren', name: 'Wren', ownerUserId: 'u-tam' },
      { id: 'oswy', name: 'Oswy', ownerUserId: 'u-lea' },
      { id: 'haeth', name: 'Brother Haeth', ownerUserId: 'u-sol' },
    ];
    const messages = [msg('a'), msg('bb', { actorId: 'oswy', playerUserId: 'u-lea', fromGm: false, senderUserId: 'u-lea' }), msg('ccc', { fromGm: false, senderUserId: 'u-tam' })];
    const threads = threadsByCharacter(messages, characters, gm);
    expect(threads.map((t) => [t.character.name, t.messages.length, t.unread, t.latest?.id ?? null])).toEqual([
      ['Wren', 2, 1, 'ccc'],
      ['Oswy', 1, 1, 'bb'],
      ['Brother Haeth', 0, 0, null],
    ]);
  });

  it('the line is the text’s first words, or the picture’s name', () => {
    expect(messageLine(msg('a', { body: 'You alone notice the lectern has been moved.' }), 20)).toBe('You alone notice th…');
    expect(messageLine(msg('a', { body: '', attachment: { name: 'Torn page', type: 'image/png', size: 9 } }))).toBe('📎 Torn page');
  });
});
