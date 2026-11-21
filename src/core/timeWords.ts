// A length of game time in plain words, for the log and the clock's lines (M5 step 5): "10 minutes",
// "1 day 2 hours", "6 seconds". At most the two largest parts; "no time" for 0.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function timeWords(seconds: number): string {
  const s = Math.max(0, Math.floor(Math.abs(seconds)));
  if (s === 0) return 'no time';
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const parts = [days && plural(days, 'day'), hours && plural(hours, 'hour'), minutes && plural(minutes, 'minute'), rest && plural(rest, 'second')].filter(Boolean);
  return parts.slice(0, 2).join(' ');
}
