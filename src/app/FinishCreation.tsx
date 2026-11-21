// The To finish card on the full sheet (05 Character sheet, 06; M5b step 0): the creation steps left with Decide
// later, one line each; a line opens that step in a pop-up, and finishing it takes the line off. The card goes when
// the last is done. The owner finishes them, approved or not; the GM can too (both may edit the sheet).
import { useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { editCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { APP_WHY, languageText, packWhy, settingLanguages, stepGuide, stepTitle, toFinishName, toFinishOf } from '../modules/characters/creationGuide.ts';
import type { FieldDefinition, FieldValues } from '../modules/characters/fields.ts';
import { languageApprovals, languagesLine, languagesPlan, picksFromSaved, type LanguagePicks } from '../modules/characters/languagesStep.ts';
import { APP_HELP, withStepApprovals } from '../modules/characters/creationSteps.ts';
import type { CampaignSetting } from './campaignSetting.ts';
import { LanguagesStep } from './LanguagesStep.tsx';
import { WeaponSkillsStep, weaponSkillsWhy } from './WeaponSkillsStep.tsx';
import { ExpertiseStep, doneWords, expertiseSetup, sameExpertise, type ExpertiseSetup } from './ExpertiseStep.tsx';
import { pointsUnspent, readExpertise, type Expertise } from '../modules/characters/expertise.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { campaignChoices, weaponSetup } from './weaponSetup.ts';
import { TraitListStep } from './TraitListStep.tsx';
import { layoutHints, traitListsOf, pickedGearEntry, traitPicksOf, traitHelp, traitSteps, traitValues, traitLines, type TraitPick } from '../modules/characters/traitLists.ts';
import { abilityNames, classRace } from '../modules/characters/creation.ts';
import { grantedWords, grantTraitGear, traitUnchanged, undoTraitGear } from './traitGear.ts';
import { entryRollPlan, rolledSpellOf, type RolledSpell } from '../modules/characters/traitSpellRoll.ts';
import { readFieldInputs, fieldInputsFrom } from '../modules/characters/fields.ts';
import { penaltyWords, picksUsed, weaponApprovals, weaponSkillsOf, type WeaponSkill } from '../modules/characters/weaponSkills.ts';
import { exceptionsOf } from './creationReview.ts';
import { InfoButton, ListRow, RowList } from '../ui/parts.tsx';
import { registry } from './services.ts';
import { saveToFinish } from './toFinish.ts';
import { BookPopUpScope, Dialog, SheetScope } from '../ui/Dialog.tsx';
import { BookType } from '../ui/creation.tsx';
import { ToFinishCard } from '../ui/organisms.tsx';
import { useToast } from '../ui/ToastHost.tsx';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The steps this app can open from the card; one it can't (from a newer version) still shows, and says so. */
const OPENS = new Set(['languages', 'weaponSkills']);

/**
 * The steps the To finish card lists, one line each, in its order (pure: the card and the Player tab's notices box
 * read the same list, row C1). Empty when nothing is left: then there is no card, and no notice.
 */
export function finishSteps({
  creation,
  classRef,
  raceRef,
  fieldDefs,
  setting,
  level,
  weaponSkills,
  expertise,
}: {
  creation: unknown;
  classRef: string | null;
  raceRef: string | null;
  fieldDefs: FieldDefinition[];
  setting: CampaignSetting | null;
  level: number;
  weaponSkills: unknown;
  /** The expertise points as saved (actors.expertise, G-208). */
  expertise?: unknown;
}): { id: string; name: string }[] {
  // Weapon skills come back to To finish whenever picks are unspent, after a level-up too (the ruling, 2026-11-01).
  const weapons = weaponSetup(setting, classRef, level);
  const unspent = weapons ? weapons.allowed - picksUsed(weaponSkillsOf(weaponSkills), weapons.proficiency) : 0;
  // A trait list put off lands on the card under the list's id (M5b step 0b); its line shows the list's name. The
  // list a per-race field points at follows the race (m5b-0c slice 6, cr-17).
  const klass = setting?.all.find((e) => e.kind === 'class' && e.packEntryId === classRef) ?? null;
  const raceId = raceRef ?? (klass && setting ? (classRace(klass.data, setting.all.filter((e) => e.kind === 'race'))?.packEntryId ?? null) : null);
  const traits = traitSteps(fieldDefs, traitListsOf(setting?.all ?? []), setting ? { layout: layoutHints(setting.all), raceId, choices: campaignChoices(setting) } : {});
  // Expertise (G-208, ex-5, ex-8): back on the card whenever points are unspent, after a level too, and for a
  // character the option reached after it was made (every point its level gives).
  const points = expertiseSetup(klass?.data, setting?.rulesSets ?? []);
  const toSpend = points ? pointsUnspent(points.rule, level, readExpertise(expertise), points.skills.map((s) => s.code)) : 0;
  // A patron is never finished here: one put off can't be sent or approved until it is picked on the Patron step (pt-10; the
  // lead's ruling, 2026-11-11), so the card never lists it.
  const listed = toFinishOf(creation).filter((s) => s !== 'weaponSkills' && s !== 'patron' && s !== 'expertise');
  return [
    ...listed.map((id) => ({ id, name: traits.find((t) => t.id === id)?.list.name ?? toFinishName(id) })),
    ...(unspent > 0 ? [{ id: 'weaponSkills', name: `Weapon skills: ${unspent} to pick` }] : []),
    // "Expertise, 1 to spend" (X5), in the pack's word for its points.
    ...(points && toSpend > 0 ? [{ id: 'expertise', name: `${points.rule.name}, ${toSpend} to spend` }] : []),
  ];
}

export function FinishCreation({
  db,
  user,
  character,
  fields,
  creation,
  classRef,
  raceRef,
  fieldDefs,
  setting,
  level,
  approved,
  gm,
  weaponSkills,
  expertise,
  onSaved,
  notice = false,
}: {
  db: Db;
  user: CurrentUser;
  character: CharacterRef;
  fields: unknown;
  creation: unknown;
  classRef: string | null;
  raceRef: string | null;
  fieldDefs: FieldDefinition[];
  setting: CampaignSetting | null;
  level: number;
  approved: boolean;
  gm: boolean;
  /** The picks as saved (actors.weapon_skills). */
  weaponSkills: unknown;
  /** The expertise points as saved (actors.expertise, G-208). */
  expertise?: unknown;
  onSaved: () => void;
  /** In the Player tab's notices sheet (row C1; frame M1e): the card's notice variant, plain rows with chevrons. */
  notice?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const weapons = weaponSetup(setting, classRef, level);
  const picks = weaponSkillsOf(weaponSkills);
  const klass = setting?.all.find((e) => e.kind === 'class' && e.packEntryId === classRef) ?? null;
  const raceId = raceRef ?? (klass && setting ? (classRace(klass.data, setting.all.filter((e) => e.kind === 'race'))?.packEntryId ?? null) : null);
  const traits = traitSteps(fieldDefs, traitListsOf(setting?.all ?? []), setting ? { layout: layoutHints(setting.all), raceId, choices: campaignChoices(setting) } : {});
  const traitOf = (id: string) => traits.find((t) => t.id === id) ?? null;
  // Expertise (G-208, ex-5, ex-8): the component needs the setup to open the step; the card's list is `finishSteps`.
  const points = expertiseSetup(klass?.data, setting?.rulesSets ?? []);
  const savedPoints = readExpertise(expertise);
  const steps = finishSteps({ creation, classRef, raceRef, fieldDefs, setting, level, weaponSkills, expertise });
  if (steps.length === 0) return null;
  const values = isRecord(fields) ? fields : {};
  const languagesField = fieldDefs.find((def) => def.key.toLowerCase() === 'languages' && !def.hidden) ?? null;
  const entries = setting?.all.filter((e) => e.kind === 'race' || e.kind === 'class') ?? [];

  async function saveLanguages(list: string[], picks: LanguagePicks): Promise<boolean> {
    if (!languagesField) return false;
    const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { fields: { ...values, [languagesField.key]: languageText(list) } as FieldValues } });
    if (!saved.ok) {
      toast({ text: saved.message });
      return false;
    }
    // A language learnt with the GM's leave (cs-6) is flagged for the GM, beside the race's and class's.
    const done = await saveToFinish(db, user, character, 'languages', false, (record) => withStepApprovals(record, 'languages', plan ? languageApprovals(plan, picks) : []));
    if (!done.ok) toast({ text: done.message });
    setOpen(null);
    onSaved();
    return done.ok;
  }

  async function saveWeapons(next: WeaponSkill[]): Promise<boolean> {
    const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { weaponSkills: next } });
    if (!saved.ok) {
      toast({ text: saved.message });
      return false;
    }
    // A weapon not the class's (R3-5) is flagged for the GM before approval, as a closed class is.
    const flags = weapons ? weaponApprovals(next, weapons.restricted, weapons.proficiency) : [];
    if (toFinishOf(creation).includes('weaponSkills') || flags.length > 0 || exceptionsOf(creation).some((e) => e.step === 'weaponSkills')) {
      const done = await saveToFinish(db, user, character, 'weaponSkills', false, (record) => withStepApprovals(record, 'weaponSkills', flags));
      if (!done.ok) toast({ text: done.message });
    }
    setOpen(null);
    onSaved();
    return true;
  }

  /** Saves the picks; `finished` false (Decide later with some picked, pf-16) keeps the step on To finish. */
  async function saveTrait(step: NonNullable<ReturnType<typeof traitOf>>, picks: TraitPick[], rolled: RolledSpell | null, finished = true): Promise<boolean> {
    const fields = readFieldInputs(fieldDefs, { ...fieldInputsFrom(fieldDefs, values), [step.field.key]: traitValues(step, picks) });
    if (!fields.ok) {
      toast({ text: fields.message });
      return false;
    }
    const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { fields: fields.values } });
    if (!saved.ok) {
      toast({ text: saved.message });
      return false;
    }
    // An entry that grants gear fills the pack (cr-17), with Undo.
    if (setting) {
      const gear = await grantTraitGear(db, user, setting, character, step.id, pickedGearEntry(step.list, picks), rolled);
      if (!gear.ok) toast({ text: gear.message });
      else if (grantedWords(gear)) toast({ text: grantedWords(gear), ...(gear.added.length > 0 ? { onUndo: () => void undoTraitGear(db, user, character, step.id).then(onSaved) } : {}) });
    }
    if (!finished) {
      setOpen(null);
      onSaved();
      return true;
    }
    const done = await saveToFinish(db, user, character, step.id, false);
    if (!done.ok) toast({ text: done.message });
    setOpen(null);
    onSaved();
    return done.ok;
  }

  const guide = setting ? stepGuide(setting.rulesSets, 'languages') : null;
  // The same Languages step as at creation (cr-15): the scores are the sheet's ability fields.
  const scores = Object.fromEntries(Object.entries(values).flatMap(([k, v]) => (typeof v === 'number' ? [[k, v]] : [])));
  const raceEntry = setting?.all.find((e) => e.kind === 'race' && e.packEntryId === raceRef) ?? null;
  const plan =
    setting && klass && languagesField
      ? languagesPlan({
          rulesSets: setting.rulesSets,
          race: raceEntry,
          klass,
          scores,
          alignment: typeof values.alignment === 'string' ? values.alignment : null,
          fields: fieldDefs,
          legacy: settingLanguages(entries, fieldDefs.map((f) => f.label)),
          creatureType: typeof raceEntry?.data.creatureType === 'string' ? raceEntry.data.creatureType : '',
        })
      : null;
  const openTrait = open ? traitOf(open) : null;
  const openPick = openTrait ? traitPicksOf(openTrait, values[openTrait.field.key]) : [];
  return (
    <>
      <ToFinishCard
        steps={steps}
        notice={notice}
        onOpen={(id) => {
          if (id === 'weaponSkills' && weapons) return setOpen(id);
          if (id === 'expertise' && points) return setOpen(id);
          if (traitOf(id)) return setOpen(id);
          if (!OPENS.has(id) || id === 'weaponSkills' || (id === 'languages' && (!languagesField || !guide || !plan))) return toast({ text: `${toFinishName(id)} can't be finished on this screen yet. Ask your GM.` });
          setOpen(id);
        }}
      />
      {/* The steps opened from To finish are creation's steps: the book's type and its fold mark (dec-10 A, cs-9). Not
          the Player tab's book pop-ups (tfb-1; the review of #1079): they keep the Sheet's own heading there too. */}
      <BookPopUpScope.Provider value={false}>
      <BookType>
      {openTrait && setting && (
        <Dialog label={openTrait.list.name} onClose={() => setOpen(null)}>
          <TraitListStep
            list={openTrait.list}
            chosen={openPick}
            {...traitLines(openTrait.list)}
            help={traitHelp(openTrait.list)}
            itemName={(itemId) => setting.items.find((i) => i.packEntryId === itemId)?.name}
            rollPlan={(entry) => entryRollPlan(entry.spellRoll, setting.all)}
            rolled={rolledSpellOf(creation, openTrait.id, openPick.flatMap((p) => ('entryId' in p ? [p.entryId] : [])).find((id) => openTrait.list.entries.find((e) => e.id === id)?.spellRoll) ?? null)}
            onSave={(picks, rolled) => saveTrait(openTrait, picks, rolled)}
            // Decide later again (pf-16): the picks made so far are kept, with the spell rolled under one; the step
            // stays on To finish. Nothing changed: nothing is saved (no gear given again, no toast, no log lines).
            onLater={(picks, rolled) =>
              openTrait.list.rolls > 1 && picks.length > 0 && !traitUnchanged(openTrait, openPick, picks, creation, rolled)
                ? void saveTrait(openTrait, picks, rolled, false)
                : setOpen(null)
            }
            onBack={() => setOpen(null)}
          />
        </Dialog>
      )}
      {open === 'languages' && guide && plan && setting && (
        <Dialog label="Languages" onClose={() => setOpen(null)}>
          <LanguagesStep
            plan={plan}
            initial={picksFromSaved(plan, languagesField ? values[languagesField.key] : '')}
            title={stepTitle(setting.rulesSets, 'languages', 'Languages')}
            why={guide.why === APP_WHY.languages ? languagesLine(guide.why, plan, abilityNames(setting.rulesSets, fieldDefs)(plan.ability).long) : guide.why}
            help={guide.help ?? APP_HELP.languages ?? null}
            onSave={saveLanguages}
            onLater={() => setOpen(null)}
            onBack={() => setOpen(null)}
          />
        </Dialog>
      )}
      {open === 'weaponSkills' && weapons && setting && (
        <Dialog label="Weapon skills" onClose={() => setOpen(null)}>
          <WeaponSkillsStep
            groups={weapons.groups}
            restricted={weapons.restricted}
            proficiency={weapons.proficiency}
            allowed={weapons.allowed}
            damageRule={weapons.damage}
            chosen={picks}
            carried={[]}
            title={stepTitle(setting.rulesSets, 'weaponSkills', 'Weapon skills')}
            why={weaponSkillsWhy(packWhy(setting.rulesSets, 'weaponSkills'), weapons.proficiency)}
            help={stepGuide(setting.rulesSets, 'weaponSkills').help ?? APP_HELP.weaponSkills ?? null}
            // After approval the owner only adds: the picks already made stay (the GM changes them).
            locked={approved && !gm ? picks.map((p) => p.itemId) : []}
            onSave={saveWeapons}
            onLater={() => setOpen(null)}
            onBack={() => setOpen(null)}
          />
        </Dialog>
      )}
      {open === 'expertise' && points && setting && (
        <ExpertisePopUp
          db={db}
          user={user}
          character={character}
          setting={setting}
          setup={points}
          level={level}
          expertise={savedPoints}
          creation={creation}
          who={{ gm, approved }}
          onClose={() => setOpen(null)}
          onSaved={onSaved}
        />
      )}
      </BookType>
      </BookPopUpScope.Provider>
    </>
  );
}

/**
 * The Expertise step in a pop-up (G-208): from To finish after a level (ex-5, X5: the new points named, after approval
 * the owner only adds) and the GM's Move points on a skill's sheet (ex-6, X6: − and + free). **Done** saves the visit
 * as one logged change, with Undo (the change's own log line, undone as the log's Undo does; the database lets the
 * owner's Undo of points just added through, guard_expertise), and takes the step off To finish if it was put there.
 */
export function ExpertisePopUp({
  db,
  user,
  character,
  setting,
  setup,
  level,
  expertise,
  creation,
  who,
  onClose,
  onSaved,
}: {
  db: Db;
  user: CurrentUser;
  character: CharacterRef;
  setting: CampaignSetting;
  setup: ExpertiseSetup;
  level: number;
  /** The points as saved (actors.expertise). */
  expertise: Expertise;
  creation: unknown;
  who: { gm: boolean; approved: boolean };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  async function save(next: Expertise): Promise<boolean> {
    if (sameExpertise(next, expertise)) {
      onClose();
      return true;
    }
    const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { expertise: next } });
    if (!saved.ok) {
      toast({ text: saved.message });
      return false;
    }
    const eventId = await latestChange(db, character.campaignId, 'character.edit', user.id);
    if (toFinishOf(creation).includes('expertise')) {
      const done = await saveToFinish(db, user, character, 'expertise', false);
      if (!done.ok) toast({ text: done.message });
    }
    onClose();
    onSaved();
    toast({
      text: doneWords(setup, expertise, next),
      ...(eventId
        ? {
            onUndo: () =>
              void runCommand(registry, db, user, undoChange, { campaignId: character.campaignId, eventId, authorUserId: user.id }).then((undone) => {
                if (!undone.ok) toast({ text: undone.message, error: true });
                onSaved();
              }),
          }
        : {}),
    });
    return true;
  }
  const afterApproval = who.approved && !who.gm;
  // Its own form wherever it opens (a pop-up opened from a sheet keeps its own: the GM's Move points).
  return (
    <SheetScope.Provider value={false}>
    <BookPopUpScope.Provider value={false}>
      <BookType>
        <Dialog label={setup.rule.name} onClose={onClose}>
          <ExpertiseStep
            setup={setup}
            level={level}
            saved={expertise}
            chosen={expertise}
            who={who}
            title={stepTitle(setting.rulesSets, 'expertise', setup.rule.name)}
            why={stepGuide(setting.rulesSets, 'expertise').why}
            // After approval the step is the line and the list (X5): no Help me choose.
            help={afterApproval ? null : stepGuide(setting.rulesSets, 'expertise').help}
            nextLabel="Done"
            onSave={save}
            onBack={onClose}
            // Back beside Done (X5; G-208 flag 2, Francis 2026-11-20): closes without saving, as the bar's ‹ does.
            backInFoot
          />
        </Dialog>
      </BookType>
    </BookPopUpScope.Provider>
    </SheetScope.Provider>
  );
}

/**
 * The full sheet's weapon skills row (the ruling, 2026-11-01): "Weapon skills · Reed spear, Eel knife · specialised",
 * with ⓘ for the pack's rule and the penalty. Only while the setting's weapon proficiency is on and something is picked.
 */
export function WeaponSkillsLine({ setting, classRef, level, weaponSkills, asRow = false }: { setting: CampaignSetting | null; classRef: string | null; level: number; weaponSkills: unknown; /** Beside the Player screen (dec-13 C12): a summary row with a chevron that opens the pack's rule and the penalty. */ asRow?: boolean }) {
  const [about, setAbout] = useState(false);
  const weapons = weaponSetup(setting, classRef, level);
  const picks = weaponSkillsOf(weaponSkills);
  if (!weapons || !setting || picks.length === 0) return null;
  const name = (itemId: string) => setting.items.find((i) => i.packEntryId === itemId)?.name ?? itemId;
  const p = weapons.proficiency;
  const penalty = p.penalty !== 0 ? `A weapon you haven't picked: ${p.penalty > 0 ? '+' : ''}${p.penalty} to hit.` : '';
  // A pick outside the class (a GM-approved exception, R3-5) says its cost in place (as-8): "Bog sling (not your class’s
  // weapon, usable at −2 to hit)".
  const outside = (itemId: string) => (penaltyWords(p) && weapons.restricted.some((w) => w.packEntryId === itemId) ? ` (not your class’s weapon, ${penaltyWords(p)})` : '');
  const rule = about && (
    <Dialog label="Weapon skills" onClose={() => setAbout(false)} reading={asRow}>
      {p.note && <p>{p.note}</p>}
      {penalty && <p>{penalty}</p>}
      {p.specialisation?.note && <p>{p.specialisation.note}</p>}
      {!p.note && !penalty && <p>Your setting says nothing more about weapon skills.</p>}
      {/* The row’s line can be cut on a narrow screen: the pop-up says each outside pick’s cost too (as-8). */}
      {asRow && picks.filter((pick) => outside(pick.itemId)).map((pick) => <p key={pick.itemId}>{name(pick.itemId)}{outside(pick.itemId)}.</p>)}
    </Dialog>
  );
  if (asRow) {
    // The cost of a pick outside the class is said in place here too (as-8).
    const names = picks.map((pick) => `${name(pick.itemId)}${pick.specialised ? ', specialised' : ''}${outside(pick.itemId)}`);
    return (
      <section className="sheet__section sheet__block weapon-skills-line" aria-label="Weapon skills">
        <RowList>
          <ListRow title="Weapon skills" sub={names.join(', ')} openLabel={`Weapon skills, ${names.join(', ')}`} onOpen={() => setAbout(true)} />
        </RowList>
        {rule}
      </section>
    );
  }
  return (
    <section className="sheet__section sheet__block weapon-skills-line" aria-label="Weapon skills">
      <p className="weapon-skills-line__text">
        <span className="label">Weapon skills</span>: {picks.map((pick) => `${name(pick.itemId)}${pick.specialised ? ', specialised' : ''}${outside(pick.itemId)}`).join(', ')}
        <InfoButton label="weapon skills" onOpen={() => setAbout(true)} />
      </p>
      {rule}
    </section>
  );
}
