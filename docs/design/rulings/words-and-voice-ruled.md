---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Words and voice, including Ogham's voice and the sign-off from §4, 2026-10-29)
supersedes: —
---

# Words and voice guide: RULED

Status: RULED 2026-10-25 (US English for the app's own text; automated check approved, app-written text only). Destination: replaces "Copy style" and extends "Voice" in `06-screens-and-design.md`. It is the text companion to the component inventory: every component's words follow it. All examples are invented.

## 1. Who is speaking

- **The app speaks plainly, as itself.** It never says "I", never says "please", and never cheers ("Great!", "Awesome", "Oops").
- **Ogham** (the archivist and teacher) speaks only in: guided-flow instructions, first-time hints, empty screens, emails, the session sign-off, and (when they return) sayings. **Never** in play screens, log lines, buttons, warnings during play, or errors.
- **The user is "you".** Other characters are named: "Wren gave Bram 3 rations."

## 2. Ten rules for every word

1. **Sentence case** everywhere: "Add item", not "Add Item". The wordmark is the one exception (small capitals).
2. **Buttons start with a verb**, 1–3 words, and name the result: "Add to Backpack", "Send to the GM", "Give 3 to Ilsa". Never "OK" or "Submit" when a verb fits. A confirm button repeats the question's verb ("Drop 3 torches?" → "Drop").
3. **Plain words over jargon.** Game terms come from the setting's own names (a pack's "kindred" stays "kindred"); developer words never appear ("pack", "entry", "field" become "setting rules", "rule", the field's label).
4. **No exclamation marks.** No "successfully" (the change shows), no "simply", "just" or "easy".
5. **Numbers as numerals:** "3 torches", "2-in-6", "5+", "Day 14, turn 3". Units with a space: "60 ft", "24 miles".
6. **Short:** labels ≤ 3 words, notes ≤ 1 line, ⓘ text ≤ 3 sentences.
7. **One name per thing,** everywhere: "Party stash", not sometimes "Stash" or "Shared pack". The component inventory and this guide's glossary are the reference.
8. **Hidden stays hidden in words too:** never hint at what a viewer can't see. Say "Charges: ?" or "What you notice", never "This item has hidden charges".
9. **No AI-sounding phrases:** avoid "delve", "embark", "unleash", "journey", "adventure awaits", "Let's…", "Here's…", "dive in", "seamless", "unlock".
10. **Spell it one way:** US English for the app's own text (color, armor); text that comes from a setting pack shows as the pack wrote it.

## 3. Patterns by component

| Where | Pattern | Example |
|---|---|---|
| Error | What happened. What to do. | "INT can't be above 18. Lower it to continue." |
| Blocked action (pop-up) | Short title, then why, then the way forward | "Can't cast · Your chainmail stops arcane casting. It ends when you take it off." |
| Confirmation dialog | Question with the verb and object; buttons echo it | "End the expedition?" · End it / Not now |
| Toast | Past tense, what moved, plus Undo | "Dropped 3 torches · Undo" |
| Empty screen | An invitation with the action (Ogham may speak) | "Nothing carved here yet. Add your first character." |
| Guided-flow instruction | One imperative line, about 12 words (Ogham) | "Roll your scores and enter them as rolled." |
| ⓘ explanation | What it is, then what it does at the table; ≤ 3 sentences; source line last | "Magic resistance is added to saves against spells…" |
| Log line | Past tense, actor first, plain facts | "You dropped 3 torches." · "Wren gave Bram 3 rations." · "You undid a drop: 3 torches are back with you." |
| Prompt (checks, rolls) | The chance first, then the action | "Roll 1d6 · lost on 1–2" |
| Modifier line | Value, then source | "+1 · Hunter (class)" |
| Status label (screen reader) | Name, then stacks or time | "Exhausted, 2 stacks" · "Blessed, 3 turns left" |
| Option row | Name, then one line of meaning | "Party's lowest · Matches the lowest active character, currently 3." |

## 4. Ogham's voice

- **Brief, calm, a little old-world,** never twee. Short sentences; concrete nouns (fire, road, door, ledger).
- **Teaches, never scolds:** "A character needs a name before the GM can see them." not "You forgot the name."
- **Allowed flavour:** "carved", "kept", "the table", "the road", "the night". **Not allowed:** archaic grammar ("thou", "'tis"), fake ancient quotes, puns in instructions.
- **Sign-off (fixed):** "Until the returning night."

## 5. Glossary (one name per thing)

Setting rules · Optional rules · Rules for this campaign · Homebrew · Party stash · Pack (a character's inventory screen) · At hand · Equipped · Stowed · Tiny · Scene · Log · Send · Reveal · Handouts · Expedition · Downtime · Archivist · Treasurer · Company · Charter · Fiat · Player proposes, GM approves.

(Claude Code adds to this list when a new name is introduced, in the same PR as the component inventory.)

## 6. How it's enforced

- **Every component in the inventory lists its text slots** and which pattern applies.
- **The gallery shows real sample text,** so wording is reviewed with the look.
- **An automated check** flags banned words, exclamation marks and Title Case in the app's text files.

- The check covers app-written text only; pack content and player notes are never checked.
