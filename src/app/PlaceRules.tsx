// A place's rules (December dec-7 piece 3; docs/plans/dec-7-linked-spots-screens.md; rulings rg-4, rg-5, mc-51, mc-49a,
// pf-12d; mockups design-december-mockups: 01-04-rules, 01-04b-rules-toggle-off, 02-20-players-rule-aid,
// 02-22-players-rule-sheet, 02-23-rules-open-and-closed, approved 2026-11-12).
//   (A rule's words are drawn by RuleText, src/ui/RuleText.tsx: moved there with dec-8 B to be shared.)
//   RuleSheet: one rule opened, for the GM and for a player alike: the rule's name, the place it belongs to, its text.
//     The ✕ closes it; it runs, proposes and sends nothing (mc-49a).
//   PlaceRulesSheet (the GM's): the stand-in check first, with its toggle (rg-5: on by default; off puts the setting's
//     check back in force here, at once, with Undo) and the sentence saying whose rule it is and what it stands in
//     for; then the place's other rules, each a tap that opens it, each with its eye (mc-51: open to players unless the
//     pack marks it the GM's alone, which says "The book keeps this for the GM."; a tap opens or closes it, at once,
//     with Undo).
//   PlaceRuleButtons (a player's): the open rules that carry a button of their own, at the left under the place's
//     description on today's place line (rp-10), a row that wraps;
//     a tap opens the rule's sheet. Where the rule's button names an icon of the app's set (pf-12c, pf-12e; dec-7
//     piece 2), the button is that icon alone, its words the screen reader's (mc-49); else the generic mark with its
//     words. (No long-press reveal of the words: no part has one yet.)
import { useEffect, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import {
  GM_ONLY_RULE_WHY,
  loadRuleSwitches,
  placeCheckOf,
  placeRulesOf,
  setCheckInForce,
  setRuleEye,
  type ChainEntry,
  type PlaceRuleRow,
  type PlayersRule,
  type RuleBlock,
  type RuleButton,
  type RuleSwitch,
} from '../modules/expedition/placeRules.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { isSetIconName, type SetIconName } from '../ui/iconSet.ts';
import { Icon } from '../ui/icons.tsx';
import { Switch } from '../ui/parts.tsx';
import { RuleText } from '../ui/RuleText.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { registry } from './services.ts';
import './PlaceRules.css';

/**
 * One rule opened (mc-49a): its name, the place it belongs to, its words. Nothing on it runs anything. `line` stands in
 * for the place's line where the rule belongs to no place: a player's Activities say "Activities" there (01-08j, P6).
 */
export function RuleSheet({ placeName, line, name, blocks, onClose }: { placeName: string; line?: string; name: string; blocks: readonly RuleBlock[]; onClose: () => void }) {
  const over = line ?? (placeName ? `${placeName}. Rules` : '');
  return (
    <Dialog wide label={name} onClose={onClose}>
      {over && <p className="auth__meta rule-sheet__place">{over}</p>}
      {blocks.length > 0 ? <RuleText blocks={blocks} /> : <p className="auth__meta">The pack gives no words for this rule.</p>}
    </Dialog>
  );
}

/**
 * How a rule's button looks (pf-12c, pf-12e, mc-49): an icon from the app's set, drawn alone, with `words` as its label
 * for a screen reader; or, where no icon resolves, the generic mark with `words` showing. Words that name a set icon
 * are that icon; the label is the button's words, else the rule's name.
 */
export function ruleButtonLook(button: RuleButton, ruleName: string): { icon: SetIconName | null; words: string } {
  if (typeof button === 'string') return isSetIconName(button) ? { icon: button, words: ruleName } : { icon: null, words: button };
  return { icon: isSetIconName(button.icon) ? button.icon : null, words: button.words || ruleName };
}

/**
 * The players' place rules as last read well (review of #726): a failed read (null) keeps the last good list, so an open
 * sheet never says "Your GM has closed this rule." because of a network blip. Only a good read changes it. (Known and
 * left as is, for the lead: when the party moves on, or the GM hides every piece, the good read drops the rules, so an
 * open sheet then says the rule is closed.)
 */
export function useLastGoodRules(rules: readonly PlayersRule[] | null): readonly PlayersRule[] {
  const [last, setLast] = useState<readonly PlayersRule[]>([]);
  // React's state from props during render: kept only when a good read brings a new list.
  if (rules && rules !== last) setLast(rules);
  return rules ?? last;
}

/** The line a player's open sheet shows once the GM has closed its rule (rp-8). */
export const RULE_CLOSED_WORDS = 'Your GM has closed this rule.';

/**
 * A player's rule buttons: one per open rule that carries a button, at the left under the description (rp-10); a tap
 * opens the rule.
 * rp-8 (mockup december/10-rule-closed-while-open, RC1b): the opened sheet stays while the GM closes the rule. It looks
 * the rule up in the rules the database gives now (by its place and name, the read sends no id), so the closed rule's
 * words go at once and "Your GM has closed this rule." shows with the information mark; if the GM opens it again while
 * the sheet is up, the words come back. Opened from a button, the X is the one way out (no Back).
 */
export function PlaceRuleButtons({ rules }: { rules: readonly PlayersRule[] }) {
  const [open, setOpen] = useState<{ placeName: string; name: string } | null>(null);
  const withButton = rules.filter((r) => r.button);
  const now = open ? rules.find((r) => r.placeName === open.placeName && r.name === open.name) : undefined;
  return (
    <>
      {withButton.length > 0 && (
        <div className="place-rule-buttons">
          {withButton.map((rule, at) => {
            const look = ruleButtonLook(rule.button!, rule.name);
            // The label names the rule too ("Someone fell in: Falling into the harbour"), past pf-12e's bare words, so a
            // screen reader hears which rule it opens, as #726's words button did (Departures, piece 2).
            const label = look.words === rule.name ? rule.name : `${look.words}: ${rule.name}`;
            const opens = () => setOpen({ placeName: rule.placeName, name: rule.name });
            // mc-49: where the icon resolves, the icon alone, its words the screen reader's; else the mark and the words.
            return look.icon ? (
              <button key={`${at}/${rule.name}`} type="button" className="button-secondary place-rule-buttons__icon" aria-label={label} onClick={opens}>
                <Icon name={look.icon} size={28} />
              </button>
            ) : (
              <button key={`${at}/${rule.name}`} type="button" className="button-secondary place-rule-buttons__button" aria-label={label} onClick={opens}>
                <Icon name="scales" size={20} />
                <span aria-hidden="true">{look.words}</span>
              </button>
            );
          })}
        </div>
      )}
      {open &&
        (now ? (
          <RuleSheet placeName={now.placeName} name={now.name} blocks={now.blocks} onClose={() => setOpen(null)} />
        ) : (
          <Dialog wide label={open.name} onClose={() => setOpen(null)}>
            <p className="auth__meta rule-sheet__place">{`${open.placeName}. Rules`}</p>
            <p className="rule-sheet__closed">
              <Icon name="info" size={20} />
              <span>{RULE_CLOSED_WORDS}</span>
            </p>
          </Dialog>
        ))}
    </>
  );
}

/**
 * The GM's Rules sheet for the place the group is at: the chain's stand-in check and rules, the GM's switches read here
 * and again after each change. `settingCheck` names the setting's encounter check the place's stands in for.
 */
export function PlaceRulesSheet({
  db,
  user,
  campaignId,
  chain,
  settingCheck,
  onChanged,
  onClose,
  onBlocked,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  chain: readonly ChainEntry[];
  settingCheck: string | null;
  onChanged: () => void;
  onClose: () => void;
  /**
   * Reading ahead on the GM's place page (plan scene-point-to-point B2): the rules stay readable, and a tap on an eye or
   * on the stand-in check's switch calls this (the page's pop-up) and writes nothing.
   */
  onBlocked?: () => void;
}) {
  const show = useToast();
  const blocked = useBlockedSheet();
  const [opened, setOpened] = useState<PlaceRuleRow | null>(null);
  const { switches, failed, busy, setBusy, reread, undoLatest, stillSaving, standIn, toggleCheck, setting } = useStandInCheck({ db, user, campaignId, chain, settingCheck, onChanged });

  const here = chain[0]?.name ?? '';
  const rows = switches ? placeRulesOf(chain, switches) : [];
  const owners = new Set(rows.map((r) => r.owner.entryId));

  async function toggleEye(row: PlaceRuleRow) {
    // A rule the pack keeps for the GM can't be opened: the tap explains (never a disabled button).
    if (row.rule.gmOnly) return blocked.explain(row.rule.name, GM_ONLY_RULE_WHY);
    if (onBlocked) return onBlocked();
    if (busy) return stillSaving();
    setBusy(true);
    const result = await runCommand(registry, db, user, setRuleEye, { campaignId, packId: row.owner.packId, entryId: row.owner.entryId, ruleId: row.rule.id, open: !row.open });
    setBusy(false);
    reread();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `${row.open ? 'Closed to players' : 'Open to players'}: ${row.rule.name}`, onUndo: () => void undoLatest(setRuleEye.name) });
  }

  return (
    <>
      <Dialog wide label="Rules" onClose={onClose}>
        {here && <p className="auth__meta rule-sheet__place">{here}</p>}
        {failed && <p className="auth__meta">Couldn't read the rules' switches. Close this and try again.</p>}
        {!switches && !failed && <p className="auth__meta">Loading the rules…</p>}
        {switches && (
          <div className="place-rules">
            {standIn && (
              <div className="place-rules__stand-in">
                <Switch label={standIn.name} on={standIn.inForce} onChange={(on) => (onBlocked ? onBlocked() : void toggleCheck(on))} />
                <StandInSentence standIn={standIn} setting={setting} />
              </div>
            )}
            {rows.length > 0 && standIn && <h4 className="label place-rules__heading">This place's other rules</h4>}
            {rows.length > 0 && (
              <ul className="place-rules__list">
                {rows.map((row) => (
                  <li key={`${row.owner.entryId}/${row.rule.id}`} className="place-rules__row">
                    <button type="button" className="place-rules__name" onClick={() => setOpened(row)}>
                      <span className="place-rules__words">{row.rule.name}</span>
                      {owners.size > 1 && <span className="auth__meta">{row.owner.name}</span>}
                      {row.rule.gmOnly && !row.open && <span className="auth__meta">The book keeps this for the GM.</span>}
                    </button>
                    <button
                      type="button"
                      className={`button-secondary place-card__eye${row.open ? ' place-card__eye--shown' : ''}`}
                      aria-label={row.rule.gmOnly ? `The GM's alone: ${row.rule.name}` : row.open ? `Close to players: ${row.rule.name}` : `Open to players: ${row.rule.name}`}
                      aria-pressed={row.open}
                      onClick={() => void toggleEye(row)}
                    >
                      <Icon name={row.open ? 'eye' : 'eye-off'} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {rows.length === 0 && !standIn && <p className="auth__meta">This place has no rules of its own.</p>}
          </div>
        )}
      </Dialog>
      {blocked.sheet}
      {opened && <RuleSheet placeName={opened.owner.name} name={opened.rule.name} blocks={opened.rule.blocks} onClose={() => setOpened(null)} />}
    </>
  );
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The place's own check that stands in for the setting's (rg-5), and its toggle: read with the GM's switches, and read
 * again after each change. Shared by the Rules sheet and the place page's "Checks here" line (5b), so both switch it
 * the same way: at once, with Undo.
 */
export function useStandInCheck({
  db,
  user,
  campaignId,
  chain,
  settingCheck,
  onChanged,
  outside = 0,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  chain: readonly ChainEntry[];
  settingCheck: string | null;
  onChanged: () => void;
  /** Bumped when the switches may have changed elsewhere (the page's Rules sheet, the log): read them again. */
  outside?: number;
}) {
  const show = useToast();
  const [switches, setSwitches] = useState<RuleSwitch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void loadRuleSwitches(db, campaignId).then((found) => {
      if (!live) return;
      setSwitches(found);
      setFailed(found === null);
    });
    return () => {
      live = false;
    };
  }, [db, campaignId, version, outside]);

  const reread = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaignId, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId, eventId, authorUserId: user.id }) : null;
    reread();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };
  // A tap while the last change is still being saved says so, rather than doing nothing (review of a5e54923).
  const stillSaving = () => show({ text: 'Still saving…' });

  const check = switches ? placeCheckOf(chain, switches) : null;
  const standIn = check?.replaces ? check : null;
  const setting = settingCheck ? `the setting's ${settingCheck}` : "the setting's encounter check";
  // The pack's own name for its check as written; only the app's default is lowered inside a sentence.
  const checkWords = (name: string) => (name === 'Encounter check' ? 'encounter check' : name);

  async function toggleCheck(on: boolean) {
    if (!standIn) return;
    if (busy) return stillSaving();
    setBusy(true);
    const result = await runCommand(registry, db, user, setCheckInForce, { campaignId, packId: standIn.owner.packId, entryId: standIn.owner.entryId, on });
    setBusy(false);
    reread();
    if (!result.ok) return show({ text: result.message, error: true });
    show({
      text: on ? `${standIn.owner.name}'s ${checkWords(standIn.name)} is in force again.` : `${standIn.owner.name}'s ${checkWords(standIn.name)} is off. ${capital(setting)} applies here.`,
      onUndo: () => void undoLatest(setCheckInForce.name),
    });
  }

  return { switches, failed, busy, setBusy, reread, undoLatest, stillSaving, check, standIn, setting, toggleCheck };
}

/** The sentence under the stand-in check: whose rule it is and what it stands in for, or that it is not in force. */
export function StandInSentence({ standIn, setting }: { standIn: { owner: { name: string }; inForce: boolean }; setting: string }) {
  return (
    <p className="place-rules__sentence">
      {standIn.inForce ? (
        `${standIn.owner.name}'s own rule. It stands in for ${setting} while the party is here.`
      ) : (
        <>
          <strong>Not in force.</strong>
          {` ${capital(setting)} applies here again, until you switch this back.`}
        </>
      )}
    </p>
  );
}

