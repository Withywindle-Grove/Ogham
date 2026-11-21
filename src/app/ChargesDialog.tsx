// The charges prompt for the GM when a charged item is first handed out (part of the Pack; ruled 2026-10-24).
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { recordRoll } from '../core/rolls.ts';
import { chargesOf, setCharges, type ChargeRules } from '../modules/inventory/charges.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { RollPrompt } from '../ui/RollPrompt.tsx';
import type { Run } from './packHelpers.ts';
import { registry } from './services.ts';

/** The charges prompt for the GM when a charged item is first handed out: the roll, or Later (from its flag). */
export function ChargesDialog({
  db,
  user,
  line,
  rules,
  campaignId,
  carrier,
  busy,
  run,
  onDone,
}: {
  db: Db;
  user: CurrentUser;
  line: InventoryLine;
  rules: ChargeRules;
  campaignId: string;
  carrier: NamedCarrier;
  busy: boolean;
  run: Run;
  onDone: () => void;
}) {
  const charged = chargesOf(line, rules);
  if (!charged) return null;
  const hidden = line.chargesHidden || rules.hidden;
  return (
    <Dialog label={`Charges of ${line.name}`} onClose={onDone}>
      <RollPrompt
        label="Charges"
        expression={charged.dice}
        busy={busy}
        onCancel={onDone}
        onRolled={(value) =>
          void run(async () => {
            const rolled = await runCommand(registry, db, user, recordRoll, { campaignId, expression: charged.dice, result: value, purpose: 'charges', gmOnly: hidden });
            if (!rolled.ok) return rolled;
            return runCommand(registry, db, user, setCharges, { line: { id: line.id, carrier }, value, hidden, roll: `${charged.dice} → ${value}` });
          }).then((done) => done && onDone())
        }
      />
      {hidden && <p className="auth__meta">Only you see this count.</p>}
    </Dialog>
  );
}
