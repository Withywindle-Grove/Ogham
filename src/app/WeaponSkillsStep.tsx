// The weapon skills step on the creation step shell (M5b step 0c, slice 6; cr-16; mockup creation/08 §1; first built in
// M5b step 0b, design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md; 06 Weapon skills step). A pick list, never
// a form field (ct-8, second test, 2026-11-02; mockup creation/10 §5): the setting's weapons the class may use, one
// pick row each, grouped by category, under a count line "Pick 2 · 1 of 2 picked" from `weaponProficiency` at the
// starting level; Other… at the foot for a weapon the list doesn't have. With the specialisation option on, the count
// line says so, the pack's rule is in the why-line, and a second Pick on a picked weapon marks it Specialised ✓✓ (a
// third unpicks). The weapons the class may not use sit in a folded group when restricted weapons are on, the pack's
// rule as its line; each can be picked (R3-5, the closed class's path): it carries the sign and "Needs the GM's special
// approval", and the GM's card lists it with the pack's rule as the why. The row opens the weapon's full entry with the same button. Opens from creation and from the To finish card.
// After approval the owner only adds (the picks already made stay), so a tap on one of those explains instead.
import { useState } from 'react';
import { APP_WHY, blurbOf } from '../modules/characters/creationGuide.ts';
import type { DamageRule } from '../modules/characters/weaponDamage.ts';
import { SPECIAL_NOTE } from '../modules/characters/creationSteps.ts';
import { picksUsed, weaponLine, type Proficiency, type WeaponSkill } from '../modules/characters/weaponSkills.ts';
import { CreationStep, FoldedGroup, OtherRow, PickGroup, PickRow } from '../ui/creation.tsx';
import { ItemEntry } from './ItemEntry.tsx';
import { useToast } from '../ui/ToastHost.tsx';

interface Weapon {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

/** The specialisation's bonus in words: "+1 to hit, +1 damage"; '' without one. */
export function specialisationBonus(p: Proficiency): string {
  const sp = p.specialisation;
  if (!sp) return '';
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  return [sp.attack ? `${signed(sp.attack)} to hit` : '', sp.damage ? `${signed(sp.damage)} damage` : ''].filter(Boolean).join(', ');
}

/**
 * The step's why-line: the pack's creationGuide line, else its weaponProficiency note, else the app's (the ruling);
 * with specialisation on, the pack's rule for it after (ct-8), else the app's words from its cost and bonus.
 */
export function weaponSkillsWhy(guideWhy: string | null, p: Proficiency): string {
  // One sentence, the ruled words (dec-10 A, cs-2); the count is the list's own line and the foot's.
  const why = guideWhy ?? (p.note || APP_WHY.weaponSkills);
  const sp = p.specialisation;
  if (!sp) return why;
  const bonus = specialisationBonus(p);
  // The pack's rule after "Specialisation is on: " (after-test A2), so it reads as the option's, not the step's.
  const rule = sp.note ? `Specialisation is on: ${sp.note}` : `Picking a weapon twice specialises it: it spends ${sp.cost} picks${bonus ? ` for ${bonus}` : ''}.`;
  return why.includes(sp.note || rule) ? why : `${why} ${rule}`;
}

/**
 * The line over the list (ct-8): "Pick 2", saying when specialisation is on. The count itself is in the footer only
 * (final drafts D, P26a: one count per step).
 */
export function weaponCountLine(_picks: readonly WeaponSkill[], p: Proficiency, allowed: number): { title: string; meta: string } {
  return { title: `Pick ${allowed}`, meta: p.specialisation ? 'Specialisation is on: pick one again to specialise' : '' };
}

/** The foot's hint: "4 of 4 picked · Reed spear spends 2". */
export function weaponSkillsHint(picks: readonly WeaponSkill[], p: Proficiency, allowed: number, nameOf: (itemId: string) => string): string {
  const special = p.specialisation ? picks.find((s) => s.specialised) : undefined;
  return `${picksUsed(picks, p)} of ${allowed} picked${special && p.specialisation ? `, ${nameOf(special.itemId)} spends ${p.specialisation.cost}` : ''}`;
}

const pageOf = (weapon: Weapon) => (typeof weapon.data.source === 'string' ? weapon.data.source.trim() : '');

export function WeaponSkillsStep({
  groups,
  restricted,
  proficiency,
  allowed,
  chosen,
  carried,
  title = 'Weapon skills',
  why,
  help,
  counter,
  locked = [],
  damageRule = null,
  onPicks,
  onSave,
  onLater,
  onBack,
}: {
  groups: { name: string; items: Weapon[] }[];
  restricted: Weapon[];
  proficiency: Proficiency;
  /** How many picks this level allows. */
  allowed: number;
  chosen: WeaponSkill[];
  /** Weapons the character already carries (item ids): marked, and first in Help me choose. */
  carried: string[];
  title?: string;
  why: string;
  help: string | null;
  counter?: { at: number; of: number };
  /** Picks the owner can't change any more (approved: only the GM removes or specialises). */
  locked?: string[];
  /** A rule that sets every weapon's die (of-8): the weapons' lines read it, with its reason. */
  damageRule?: DamageRule | null;
  /** Told of every change, so Back keeps the picks (cr-2). */
  onPicks?: (picks: WeaponSkill[]) => void;
  onSave: (picks: WeaponSkill[]) => Promise<boolean>;
  onLater?: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [picks, setLocal] = useState<WeaponSkill[]>(chosen);
  const [openedWith] = useState(chosen);
  const setPicks = (next: WeaponSkill[]) => {
    setLocal(next);
    onPicks?.(next);
  };
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const used = picksUsed(picks, proficiency);
  const left = allowed - used;
  const sp = proficiency.specialisation;
  const lockedWords = 'Only the GM can change a weapon skill once the character is approved.';
  // Every weapon the step lists: the class's, then those it may not use (pickable with the sign, R3-5).
  const shownRestricted = proficiency.restricted ? restricted : [];
  const all = [...groups.flatMap((g) => g.items), ...shownRestricted];
  const isRestricted = (itemId: string) => shownRestricted.some((w) => w.packEntryId === itemId);
  // Read once as the step opens: the fold starts open only with a pick inside (a pick is never hidden).
  const [restrictedOpen] = useState(() => chosen.some((p) => isRestricted(p.itemId)));
  // A typed Other… keeps its name as its id (ct-8).
  const nameOf = (itemId: string) => all.find((w) => w.packEntryId === itemId)?.name ?? itemId;
  const typed = picks.filter((p) => p.other || !all.some((w) => w.packEntryId === p.itemId));
  const count = weaponCountLine(picks, proficiency, allowed);
  const pickedWords = (pick: WeaponSkill | undefined) => (pick?.specialised ? 'Specialised ✓✓' : undefined);

  /**
   * The row's button, one cycle (ct-8): Pick → Picked ✓; with specialisation, a second Pick → Specialised ✓✓ (it moves
   * from another weapon); a third, or a second when the picks left can't pay for it, unpicks and says why.
   */
  function tap(itemId: string, name: string, other = false) {
    const picked = picks.find((p) => p.itemId === itemId);
    if (!picked) {
      // More than the count can't be picked: the row says why, never greyed.
      if (left < 1) return toast({ text: `${used} of ${allowed} picked: take one off to pick another.` });
      return setPicks([...picks, other ? { itemId, other: true as const } : { itemId }]);
    }
    if (locked.includes(itemId)) return toast({ text: lockedWords });
    if (!sp || picked.specialised) return setPicks(picks.filter((p) => p !== picked));
    // One weapon at most: specialising this one moves it from another.
    const plain = (p: WeaponSkill): WeaponSkill => (p.other ? { itemId: p.itemId, other: true as const } : { itemId: p.itemId });
    const others = picks.map((p) => (p.specialised ? plain(p) : p));
    if (allowed - picksUsed(others, proficiency) < sp.cost - 1) {
      setPicks(picks.filter((p) => p !== picked));
      return toast({ text: `${name} unpicked. Specialising spends ${sp.cost} of your ${allowed} picks, so unpick another first.` });
    }
    const moved = picks.find((p) => p.specialised);
    setPicks(others.map((p) => (p.itemId === itemId ? { ...p, specialised: true as const } : p)));
    if (moved) toast({ text: `${name} specialised. ${nameOf(moved.itemId)} is back to one pick.` });
  }

  async function next() {
    if (busy) return;
    // Next stays tappable and says what's missing (cr-2).
    if (left > 0) return toast({ text: `Pick ${left} more${onLater ? ', or Decide later' : ''}.` });
    setBusy(true);
    await onSave(picks);
    setBusy(false);
  }

  const helpChoices = [...all.filter((w) => carried.includes(w.packEntryId) && !isRestricted(w.packEntryId)), ...all.filter((w) => !carried.includes(w.packEntryId) && !isRestricted(w.packEntryId))].map((w) => ({
    name: carried.includes(w.packEntryId) ? `${w.name}, in your pack` : w.name,
    blurb: blurbOf(w.data) || weaponLine(w, damageRule),
  }));
  const open = opened ? all.find((w) => w.packEntryId === opened) : undefined;
  // The weapon's full entry (R3-10): the pack's description, qualities, damage and use, cost, weight, source; Pick.
  const panel = open ? (
    <ItemEntry
      item={open}
      damageRule={damageRule}
      picked={picks.some((p) => p.itemId === open.packEntryId)}
      pickedLabel={pickedWords(picks.find((p) => p.itemId === open.packEntryId))}
      onPick={() => {
        tap(open.packEntryId, open.name);
        setOpened(null);
      }}
      onClose={() => setOpened(null)}
    />
  ) : null;

  return (
    <CreationStep
      title={title}
      counter={counter}
      why={why}
      help={help}
      helpChoices={helpChoices}
      onBack={onBack}
      decideLater={onLater ? { onPick: onLater } : undefined}
      hint={weaponSkillsHint(picks, proficiency, allowed, nameOf)}
      busy={busy}
      waitsOnline
      unchanged={JSON.stringify(picks) === JSON.stringify(openedWith)}
      onNext={() => void next()}
    >
      <h2 className="pick-group__head weapon-skills__count">
        <span className="pick-group__title">{count.title}</span>
        {/* No middle dot (final drafts A9): the meta set apart by space and type; a reader hears a comma. */}
        {count.meta && (
          <>
            <span className="visually-hidden">,</span> <span className="pick-group__meta">{count.meta}</span>
          </>
        )}
      </h2>
      {groups.map((group) => (
        <PickGroup key={group.name} title={group.name} meta={group.items.some((w) => carried.includes(w.packEntryId)) ? 'you carry one' : undefined}>
          {group.items.map((weapon) => {
            const pick = picks.find((p) => p.itemId === weapon.packEntryId);
            return (
              <PickRow
                key={weapon.packEntryId}
                name={weapon.name}
                blurb={[weaponLine(weapon), carried.includes(weapon.packEntryId) ? 'in your pack' : ''].filter(Boolean).join(', ')}
                source={pageOf(weapon) || undefined}
                picked={!!pick}
                pickedLabel={pickedWords(pick)}
                onPick={() => tap(weapon.packEntryId, weapon.name)}
                onOpen={() => setOpened(opened === weapon.packEntryId ? null : weapon.packEntryId)}
              />
            );
          })}
        </PickGroup>
      ))}
      {typed.map((pick) => (
        <PickRow key={pick.itemId} name={pick.itemId} blurb="Typed in by you" picked pickedLabel={pickedWords(pick)} onPick={() => tap(pick.itemId, pick.itemId, true)} />
      ))}
      <OtherRow
        label="A weapon the list doesn't have"
        blurb="Type its name; it counts as one pick."
        onAdd={(name) => {
          const listed = all.find((w) => w.name.toLowerCase() === name.toLowerCase());
          const id = listed?.packEntryId ?? name;
          if (picks.some((p) => p.itemId.toLowerCase() === id.toLowerCase())) return toast({ text: `${listed?.name ?? name} is picked already.` });
          tap(id, listed?.name ?? name, !listed);
        }}
        onEmpty={() => toast({ text: 'Type a name first, then tap Add.' })}
      />
      {proficiency.restricted && restricted.length > 0 && (
        // Collapsed under its fold row, the pack's rule text its line (R3-5); each row pickable with the sign.
        <FoldedGroup label={`Not your class's weapons: ${restricted.length}`} note={proficiency.restricted.note || undefined} open={restrictedOpen}>
          {restricted.map((weapon) => {
            const pick = picks.find((p) => p.itemId === weapon.packEntryId);
            return (
              <PickRow
                key={weapon.packEntryId}
                name={weapon.name}
                blurb={weaponLine(weapon) || undefined}
                fit={[{ text: SPECIAL_NOTE, warn: true }]}
                source={pageOf(weapon) || undefined}
                picked={!!pick}
                pickedLabel={pickedWords(pick)}
                onPick={() => tap(weapon.packEntryId, weapon.name)}
                onOpen={() => setOpened(opened === weapon.packEntryId ? null : weapon.packEntryId)}
              />
            );
          })}
        </FoldedGroup>
      )}
      {panel}
    </CreationStep>
  );
}
