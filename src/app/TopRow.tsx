import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadCampaignHeading } from '../core/myCampaigns.ts';
import type { Db } from '../core/supabase.ts';
import { MenuItems, MoreMenu, MoreSheet } from '../ui/MoreMenu.tsx';
import { LogButton, useLogVersion } from './campaignLog.tsx';
import { ReferenceButton } from './GmReference.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { MessagesButton } from './Messages.tsx';
import { Portrait } from './Portrait.tsx';
import { ShellDrawer, ShellMenuItems } from './shellMenu.tsx';
import { Icon } from '../ui/icons.tsx';
import './TopRow.css';
import { usePhone } from './useWide.ts';

// The one row at the top of every screen but sign-in and Your campaigns (2026-10-23): a back link on the left,
// the GM's Reference (open book, M5 gate B4), Log and ⋯ on the right (Log inside a campaign only). At a campaign screen's top level the back link shows the campaign's sigil and name
// ("‹ The Ash Barrows"); sub-screens name where they go back to ("‹ Players"). The ⋯ holds the
// screen's own options, then This device, Rules library and Sign out. It stays at the top as you scroll (2026-10-23).
// Below it, on every screen inside a provider: what the screen's owner puts there (the GM's Compact time strip during
// an adventure, DG2), so it stays in view as you scroll too.
const BelowTopRow = createContext<ReactNode>(null);

/** What shows under the top row on every screen below this (DG2: the GM's Compact time strip). */
export function BelowTopRowProvider({ below, children }: { below: ReactNode; children: ReactNode }) {
  return <BelowTopRow.Provider value={below}>{children}</BelowTopRow.Provider>;
}

export function TopRow({
  back,
  backShort,
  campaign,
  onBack,
  menuLabel = 'Account and device options',
  actions,
  drawer,
  title,
  logTab = false,
  standard = false,
  named = false,
  children,
}: {
  /** Where the back link goes, in words: "Your campaigns", "Players". */
  back?: string;
  /** `back` on a phone, so it never truncates: "Campaigns" for "Your campaigns" (gate walk, Francis 2026-11-05). */
  backShort?: string;
  /** Instead of `back`: the campaign whose sigil and name the back link shows. `version` reloads them after a rename. */
  campaign?: { db: Db; campaign: OpenCampaign; version?: number };
  onBack: () => void;
  /** The ⋯ button's name for screen readers. */
  menuLabel?: string;
  /** Buttons beside the ⋯ (the full sheet's Edit). */
  actions?: ReactNode;
  /**
   * A campaign's top level (final drafts A11, slice E): the campaign's name. On a phone the back link gives way to ≡,
   * which opens the drawer under this name, and the drawer's Your campaigns does what the back link did; the ⋯ keeps
   * only the screen's own options (and hides with none), as the drawer holds the rest (Design on #549). A tablet keeps
   * the back link and its whole ⋯.
   */
  drawer?: string;
  /** Beside ≡, when not the campaign's name: the Player tab's character (Design on #549, mockup 17). */
  title?: string;
  /** Log is one of this screen's tabs on a phone (the player's tab bar, slice E), so the row leaves its Log out there. */
  logTab?: boolean;
  /**
   * Creation's standard (plan m5b-players-screens-standard A1; the Player screen, the Pack, the full sheet): the
   * title centred between the start (≡ on a phone, the back link or ← elsewhere) and the end, and ⋯ opens as a Sheet:
   * the screen's own options first, then, where there is no drawer, a divider and the app's menu. A sub-screen
   * (`back` without `campaign`) shows ← as an icon named "Back to <back>", never "‹".
   */
  standard?: boolean;
  /**
   * With `standard` and `back`: the back link in words, "‹ Players", instead of ←, on a phone too, where it takes ≡'s
   * place (the GM's view as the player: page 32, M3c, M3j; pg32-2).
   */
  named?: boolean;
  /** The screen's own ⋯ options, shown first. */
  children?: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const phone = usePhone();
  const withDrawer = phone && drawer !== undefined;
  const below = useContext(BelowTopRow);
  // Its height, for what sticks below it (the landscape tabs, Add item's search). It grows with the text size.
  useEffect(() => {
    const el = row.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const root = document.documentElement.style;
    const measure = () => root.setProperty('--top-row-h', `${el.getBoundingClientRect().height}px`);
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    measure();
    return () => {
      watch.disconnect();
      root.removeProperty('--top-row-h');
    };
  }, []);

  if (standard) {
    const own = children ? <MenuItems>{children}</MenuItems> : null;
    return (
      <div ref={row} className="top-row top-row--standard">
        <div className={`top-row__lead${named && !withDrawer && !campaign ? ' top-row__lead--named' : ''}`}>
          {withDrawer ? (
            <DrawerStart title={title ?? drawer} drawerTitle={drawer} onYourCampaigns={onBack} bare />
          ) : campaign ? (
            <button type="button" className="button-quiet top-row__back" onClick={onBack}>
              <CampaignBack {...campaign} />
            </button>
          ) : named ? (
            <button type="button" className="button-quiet top-row__back" onClick={onBack}>
              ‹ {back}
            </button>
          ) : (
            <button type="button" className="top-row__menu top-row__arrow" aria-label={back ? `Back to ${back}` : 'Back'} onClick={onBack}>
              <Icon name="back" />
            </button>
          )}
        </div>
        {(title ?? (withDrawer ? drawer : undefined)) ? <span className="top-row__title top-row__title--centred">{title ?? drawer}</span> : <span />}
        <div className="top-row__end">
          {actions}
          {/* The Log (the open book) before Messages, as frame P1 of december/14 draws the bar (Francis's fix 4, 19 Nov 2026). */}
          {!(phone && logTab) && <LogButton />}
          <MessagesButton />
          <ReferenceButton />
          {withDrawer ? (
            own && <MoreSheet label={menuLabel}>{own}</MoreSheet>
          ) : (
            <MoreSheet label={menuLabel}>
              {own}
              <ShellMenuItems />
            </MoreSheet>
          )}
        </div>
        {below && <div className="top-row__below">{below}</div>}
      </div>
    );
  }

  return (
    <div ref={row} className="top-row">
      {withDrawer ? (
        <DrawerStart title={title ?? drawer} drawerTitle={drawer} onYourCampaigns={onBack} />
      ) : (
        <button type="button" className="button-quiet top-row__back" onClick={onBack}>
          {campaign ? <CampaignBack {...campaign} /> : `‹ ${phone && backShort ? backShort : back}`}
        </button>
      )}
      <div className="top-row__end">
        {actions}
        {/* ✉ Messages (M5 gate B3): the GM and players, with the unread count. */}
        <MessagesButton />
        <ReferenceButton />
        {!(phone && logTab) && <LogButton />}
        {withDrawer ? (
          children && (
            <MoreMenu label={menuLabel}>
              <MenuItems>{children}</MenuItems>
            </MoreMenu>
          )
        ) : (
          <MoreMenu label={menuLabel}>
            {children && <MenuItems>{children}</MenuItems>}
            <ShellMenuItems />
          </MoreMenu>
        )}
      </div>
      {below && <div className="top-row__below">{below}</div>}
    </div>
  );
}

/**
 * ≡ and the campaign's name, at the top left of a campaign's screen on a phone (final drafts A11, slice E): ≡ opens
 * the drawer (`ShellDrawer`); closing it brings focus back to ≡.
 */
export function DrawerStart({ title, drawerTitle = title, onYourCampaigns, bare = false }: { title: string; drawerTitle?: string; onYourCampaigns: () => void; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div className="top-row__start">
      <button ref={button} type="button" className="top-row__menu" aria-label="Menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      {/* The standard bar (A1) puts the title in its own centred column instead (`bare`). */}
      {!bare && <span className="top-row__title">{title}</span>}
      {open && (
        <ShellDrawer
          title={drawerTitle}
          onYourCampaigns={onYourCampaigns}
          onClose={() => {
            setOpen(false);
            // Back to ≡ without scrolling, so the screen keeps its place (as the log does).
            button.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </div>
  );
}

// "‹ [sigil] The Ash Barrows": the sigil only when the campaign has a picture; a long name ends in "…" on
// screen (the whole name stays in the text, for screen readers).
function CampaignBack({ db, campaign, version = 0 }: { db: Db; campaign: OpenCampaign; version?: number }) {
  const logVersion = useLogVersion();
  const [heading, setHeading] = useState<{ name: string; sigilAssetId: string | null }>({ name: campaign.name, sigilAssetId: null });

  useEffect(() => {
    let current = true;
    loadCampaignHeading(db, campaign.id).then(
      (found) => current && found && setHeading(found),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, version, logVersion]);

  return (
    <>
      ‹{' '}
      {heading.sigilAssetId && (
        <span className="top-row__sigil">
          <Portrait db={db} campaignId={campaign.id} assetId={heading.sigilAssetId} name={heading.name} size="small" />{' '}
        </span>
      )}
      {heading.name}
    </>
  );
}
