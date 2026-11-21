// The words about the place a group is entering (fm-1), for the log's travel lines, the travel card and its toasts.
// A place's name waits for the GM's Show players: the database gives a group's players the place's name only once it
// has been shown to them (travel_groups.pending_place_name; the GM's own name for it is in the GM-only
// travel_group_secrets). `name` is null for a reader who has no name for the place, and the words then say "the next
// place". Design settles these words; they live here and nowhere else.

const UNNAMED = 'the next place';

export const TRAVEL_PLACE_WORDS = {
  /** The card's shortfall line (S4): "Entering Reed Hollow, 2 more tomorrow". */
  card: (owed: number | string, name: string | null) => `Entering ${name ?? UNNAMED}, ${owed} more tomorrow`,
  /** A morning or a forced march that pays what was owed: "arrived at Reed Hollow". */
  arrived: (name: string | null) => `arrived at ${name ?? UNNAMED}`,
  /** A morning that pays only part: "3 more owed for Reed Hollow". */
  owed: (owed: number | string, name: string | null) => (name ? `${owed} more owed for ${name}` : `${owed} more owed to enter ${UNNAMED}`),
  /** A Move… that falls short: "moved the party on: entering Reed Hollow, 4 more tomorrow". */
  entering: (group: string, owed: number | string, name: string | null) =>
    name ? `moved ${group} on: entering ${name}, ${owed} more tomorrow` : `moved ${group} on: ${owed} more tomorrow to enter ${UNNAMED}`,
  /** A new Move… over an owed one: "Course changed: 4 owed for Reed Hollow dropped". */
  dropped: (owed: number | string, name: string | null) => `Course changed: ${owed} owed for ${name ?? UNNAMED} dropped`,
  /**
   * A new Move… over an owed one at the same cost (what's owed doesn't change, so the line holds no number):
   * "changed the party's course: entering Reed Hollow instead of Black Mere, the same points still owed".
   */
  rerouted: (group: string, from: string | null, to: string | null) =>
    from === null && to === null
      ? `changed ${group}'s course, the same points still owed`
      : `changed ${group}'s course: entering ${to ?? UNNAMED} instead of ${from ?? UNNAMED}, the same points still owed`,
};
