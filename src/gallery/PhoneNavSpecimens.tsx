// The phone's navigation (final drafts A11, slice E; mockup creation/17) for the gallery: the tab bar (current tab
// bold with the accent mark, the badge at 1, 99 and past 99, the GM's bar with its badge on Players), ≡ with a long
// campaign name (the drawer closed), and the drawer open for a player and for the GM (with the gear). Invented names only.
import type { ReactNode } from 'react';
import { CampaignMenuProvider, PersonProvider, ShellDrawer } from '../app/shellMenu.tsx';
import { gmPhoneTabs, phoneTabs } from '../app/navTabs.ts';
import { DrawerStart } from '../app/TopRow.tsx';
import { MenuItem } from '../ui/MoreMenu.tsx';
import { SectionNav } from '../ui/SectionNav.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactNode;

const LONG = 'The Lantern Marsh and the Long Causeway of the Seven Drowned Bells'; // words: names
const MARSH = 'The Lantern Marsh'; // words: names
const OSWIN = 'Oswin Adderbald'; // words: names
const TAMSIN = 'Tamsin Mossfoot of the Reedmouth Ferry Landing'; // words: names
const HOLLIS = 'Hollis Reed'; // words: names
const FRANCESCA = 'Francesca Wetherby-Underhill'; // words: names
const none = () => undefined;

const playerItems = (
  <>
    <MenuItem icon="sheet" onClick={none}>
      Full character sheet
    </MenuItem>
    <MenuItem icon="company" onClick={none}>
      Company
    </MenuItem>
    <MenuItem icon="scales" onClick={none}>
      Setting rules
    </MenuItem>
  </>
);

// A player with no character yet: nothing to open but the setting's rules (Design's nit on #549).
const noCharacterItems = (
  <MenuItem icon="scales" onClick={none}>
    Setting rules
  </MenuItem>
);

const characterRows = (
  <>
    <MenuItem avatar="O" current onClick={none}>
      {OSWIN}
    </MenuItem>
    <MenuItem avatar="T" onClick={none}>
      {TAMSIN}
    </MenuItem>
    <MenuItem avatar="H" sub="Waiting for the GM" onClick={none}>
      {HOLLIS}
    </MenuItem>
  </>
);

const yourCharacters = (
  <MenuItem icon="characters" onClick={none}>
    Your characters
  </MenuItem>
);

export function PhoneNavSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Tab bar, a player's phone: Player current (bold, the accent mark above), nothing waiting">
        <div className="gallery__tabbar">
          <SectionNav label="Tab bar, Player current" tabs={phoneTabs(0)} current="player" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Tab bar: Scene current, 1 message waiting on it">
        <div className="gallery__tabbar">
          <SectionNav label="Tab bar, Scene current" tabs={phoneTabs(1)} current="scene" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Tab bar: Log current, 99 waiting on Scene">
        <div className="gallery__tabbar">
          <SectionNav label="Tab bar, 99 waiting" tabs={phoneTabs(99)} current="log" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Tab bar: 120 waiting shows 99+">
        <div className="gallery__tabbar">
          <SectionNav label="Tab bar, past 99" tabs={phoneTabs(120)} current="pack" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Tab bar, a caster's phone: five, Magic current (mm-2)">
        <div className="gallery__tabbar">
          <SectionNav label="Tab bar, Magic current" tabs={phoneTabs(0, true)} current="magic" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Tab bar, the GM's: Scene, Players with 99 waiting as a badge (and its glow), Rules, Log">
        <div className="gallery__tabbar">
          <SectionNav label="Tab bar, the GM's" tabs={gmPhoneTabs({ toApprove: 99, toAnswer: 0, toPick: 0 })} current="players" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="The drawer closed: ≡ and a long campaign name, cut with …">
        <div className="gallery__drawer-bar">
          <CampaignMenuProvider items={playerItems} characters={yourCharacters} characterRows={characterRows}>
            <DrawerStart title={LONG} onYourCampaigns={none} />
          </CampaignMenuProvider>
        </div>
      </Specimen>
      <Specimen name="The drawer open, a player's: This campaign, Your characters (the active one marked), Elsewhere, the person">
        <PersonProvider name={FRANCESCA}>
          <CampaignMenuProvider items={playerItems} characters={yourCharacters} characterRows={characterRows}>
            <ShellDrawer title={LONG} onYourCampaigns={none} onClose={none} preview />
          </CampaignMenuProvider>
        </PersonProvider>
      </Specimen>
      {/* Nothing to open yet (Design on #549): no Full character sheet and no Company, only Setting rules. */}
      <Specimen name="The drawer open, a player with no characters yet">
        <PersonProvider name="Bramble">
          <CampaignMenuProvider items={noCharacterItems} characters={yourCharacters}>
            <ShellDrawer title="Reedmouth" onYourCampaigns={none} onClose={none} preview />
          </CampaignMenuProvider>
        </PersonProvider>
      </Specimen>
      <Specimen name="The drawer open, the GM's: the gear beside the name, As the GM, Elsewhere, the person">
        <PersonProvider name="Priya">
          <CampaignMenuProvider
            settings={none}
            gm={
              <MenuItem icon="company" onClick={none}>
                Companies
              </MenuItem>
            }
          >
            <ShellDrawer title={MARSH} onYourCampaigns={none} onClose={none} preview />
          </CampaignMenuProvider>
        </PersonProvider>
      </Specimen>
    </>
  );
}
