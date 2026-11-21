import { createContext, useContext, useState, type ReactNode } from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { DeviceMenuSection, MenuItem, MenuItems } from '../ui/MoreMenu.tsx';
import { AppVersionSection } from './AppUpdate.tsx';
import './shellMenu.css';

// What every ⋯ menu ends with (2026-10-23, the single top row): inside a campaign, the campaign's own items (one ⋯
// menu everywhere in a campaign, ruled 2026-10-28, N17); then This device; then the account items Root fills in
// once someone is signed in (Rules library, Sign out); and at the foot, the version on this device with Check for a
// new version (F55, au-1). Each screen's own options go above, before a divider.
// The phone's drawer (final drafts A11, slice E) shows the same items, grouped (`ShellDrawer`, below): build once.
const AccountItems = createContext<ReactNode>(null);
const CampaignItems = createContext<CampaignMenu | null>(null);
const Person = createContext<string | null>(null);

/**
 * The campaign's items, in the drawer's groups. The ⋯ shows them in one list, in this order: `characters`, `items`,
 * `gm`. `characterRows` are the drawer's alone: one row per character, the current one marked.
 */
type CampaignMenu = {
  items?: ReactNode;
  characters?: ReactNode;
  characterRows?: ReactNode;
  gm?: ReactNode;
  /** The GM's campaign settings (Rules for this campaign): the gear at the drawer's top (Design on #549). A player has none. */
  settings?: () => void;
};

export function ShellMenuProvider({ account, children }: { account: ReactNode; children: ReactNode }) {
  return <AccountItems.Provider value={account}>{children}</AccountItems.Provider>;
}

/** Who is signed in, by their table name: the drawer's foot (slice E). */
export function PersonProvider({ name, children }: { name: string; children: ReactNode }) {
  return <Person.Provider value={name}>{children}</Person.Provider>;
}

/**
 * The campaign's ⋯ items, on every screen inside it: `items` the campaign's own ("This campaign" in the drawer: a
 * player's Full character sheet, Company, Setting rules), `characters` the way to Your characters, `gm` the GM's
 * (Companies). `characterRows` show in the phone's drawer only.
 */
export function CampaignMenuProvider({ items, characters, characterRows, gm, settings, children }: CampaignMenu & { children: ReactNode }) {
  return <CampaignItems.Provider value={{ items, characters, characterRows, gm, settings }}>{children}</CampaignItems.Provider>;
}

/** The campaign's items (inside a campaign), the This device section (theme, text size) and the account section, for inside a MoreMenu. */
export function ShellMenuItems() {
  const account = useContext(AccountItems);
  const campaign = useContext(CampaignItems);
  const any = campaign && (campaign.characters || campaign.items || campaign.gm);
  return (
    <>
      {any && (
        <MenuItems>
          {campaign.characters}
          {campaign.items}
          {campaign.gm}
        </MenuItems>
      )}
      <DeviceMenuSection />
      {account && <MenuItems>{account}</MenuItems>}
      <AppVersionSection />
    </>
  );
}

/** One of the drawer's groups: a small heading over its rows. Left out when it has nothing in it. */
function DrawerGroup({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <section className="nav-drawer__group" aria-label={title}>
      <p className="nav-drawer__heading">{title}</p>
      <MenuItems>{children}</MenuItems>
    </section>
  );
}

/**
 * The phone's drawer (final drafts A11, slice E; mockup creation/17), opened by ≡ at the top left of a campaign's
 * screen: the campaign's name (with the GM's gear, which opens Rules for this campaign; Design on #549), then **This campaign**, **Your characters**, **As the GM** (the GM's items) and
 * **Elsewhere** (Your campaigns), each left out when empty; the person at the foot, whose row unfolds This device and
 * the account's items (Rules library, Sign out). Every item is the ⋯'s own (`CampaignMenuProvider`,
 * `ShellMenuProvider`), never a copy. Choosing an item closes it; a switch (theme, text size) or the foot's fold
 * doesn't.
 */
export function ShellDrawer({ title, onYourCampaigns, onClose, preview = false }: { title: string; onYourCampaigns: () => void; onClose: () => void; preview?: boolean }) {
  const account = useContext(AccountItems);
  const campaign = useContext(CampaignItems);
  const person = useContext(Person);
  const [footOpen, setFootOpen] = useState(false);
  const settings = campaign?.settings;
  const gear = settings ? (
    <button
      type="button"
      className="nav-drawer__gear"
      aria-label="Campaign settings"
      onClick={() => {
        settings();
        onClose();
      }}
    >
      <Icon name="gear" />
    </button>
  ) : null;
  const characters = campaign?.characterRows || campaign?.characters ? (
    <>
      {campaign.characterRows}
      {campaign.characters}
    </>
  ) : null;
  return (
    <Dialog label={title} onClose={onClose} drawer preview={preview} headAction={gear}>
      <nav
        className="nav-drawer"
        aria-label="Menu"
        onClick={(event) => {
          const chosen = (event.target as HTMLElement).closest('button');
          if (chosen && !chosen.hasAttribute('aria-pressed') && !chosen.hasAttribute('aria-expanded')) onClose();
        }}
      >
        <DrawerGroup title="This campaign">{campaign?.items}</DrawerGroup>
        <DrawerGroup title="Your characters">{characters}</DrawerGroup>
        <DrawerGroup title="As the GM">{campaign?.gm}</DrawerGroup>
        <DrawerGroup title="Elsewhere">
          <MenuItem icon="banners" onClick={onYourCampaigns}>
            Your campaigns
          </MenuItem>
        </DrawerGroup>
        <div className="nav-drawer__foot">
          <button type="button" className="more-menu__item nav-drawer__person" aria-expanded={footOpen} onClick={() => setFootOpen((open) => !open)}>
            <span className="more-menu__avatar" aria-hidden="true">
              {(person ?? 'You').trim().charAt(0).toUpperCase() || '?'}
            </span>
            <span className="more-menu__words">
              <span>{person ?? 'You'}</span>
              <span className="more-menu__sub">App settings, sign out</span>
            </span>
          </button>
          {footOpen && (
            <div className="nav-drawer__settings">
              <DeviceMenuSection />
              {account && <MenuItems>{account}</MenuItems>}
              <AppVersionSection />
            </div>
          )}
        </div>
      </nav>
    </Dialog>
  );
}
