import { useEffect, useLayoutEffect, useState, type ComponentProps, type FormEvent } from 'react';
import { forgetAllKept } from './keptCreation.ts';
import { signOut } from '../core/auth.ts';
import { renameProfile } from '../core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCurrentUser } from '../core/currentUser.ts';
import { loadMyProfile, type MyProfile } from '../core/profile.ts';
import type { Db } from '../core/supabase.ts';
import { CampaignPicker, JoinCampaign, type OpenCampaign } from './Campaigns.tsx';
import type { NewCampaign as NewCampaignScreen } from './NewCampaign.tsx';
import type { CreateCharacter as CreateCharacterScreen, PlayerCampaign as PlayerCampaignScreen } from './Characters.tsx';
import type { GmCampaign as GmCampaignScreen } from './GmCampaign.tsx';
import type { LibraryScreen as LibraryScreenType } from './LibraryScreen.tsx';
import { lazyScreen } from './lazyScreen.tsx';
import { clearPendingInvite, pendingInvite } from './pendingInvite.ts';
import { keptPlace, notePlace, placeRestored } from './placeOnReload.ts';
import { registry } from './services.ts';
import { CampaignLog } from './campaignLog.tsx';
import { Messaging } from './Messages.tsx';
import { TopRow } from './TopRow.tsx';
import { CampaignMenuProvider, PersonProvider } from './shellMenu.tsx';
import { MenuItem } from '../ui/MoreMenu.tsx';
import './SignIn.css';
import { ErrorToast } from '../ui/ToastHost.tsx';

// The bigger screens load the first time they open (perf report 2026-11-06, fix 1), each in its own piece, and are
// fetched in the background once Your campaigns is showing (Home, below).
const NewCampaign = lazyScreen<ComponentProps<typeof NewCampaignScreen>>(() => import('./NewCampaign.tsx').then((m) => m.NewCampaign));
const CreateCharacter = lazyScreen<ComponentProps<typeof CreateCharacterScreen>>(() =>
  import('./Characters.tsx').then((m) => m.CreateCharacter),
);
const PlayerCampaign = lazyScreen<ComponentProps<typeof PlayerCampaignScreen>>(() =>
  import('./Characters.tsx').then((m) => m.PlayerCampaign),
);
const LibraryScreen = lazyScreen<ComponentProps<typeof LibraryScreenType>>(() => import('./LibraryScreen.tsx').then((m) => m.LibraryScreen));
/** The GM's campaign inside its reference provider; both pieces load side by side. */
const GmCampaign = lazyScreen<ComponentProps<typeof GmCampaignScreen>>(async () => {
  const [{ GmReferenceProvider }, { GmCampaign: Screen }] = await Promise.all([import('./GmReference.tsx'), import('./GmCampaign.tsx')]);
  return function GmCampaignWithReference(props: ComponentProps<typeof GmCampaignScreen>) {
    return (
      <GmReferenceProvider db={props.db} campaign={props.campaign}>
        <Screen {...props} />
      </GmReferenceProvider>
    );
  };
});

type Loaded = { user: CurrentUser; profile: MyProfile };

type View =
  | { kind: 'picker' }
  | { kind: 'new' }
  | { kind: 'join'; code: string }
  | { kind: 'campaign'; campaign: OpenCampaign; open?: 'list' | 'rules' }
  | { kind: 'create'; campaign: OpenCampaign }
  | { kind: 'library' };

/** After sign-in: ask for a name once, then the campaign picker. */
export function SignedIn({
  db,
  userId,
  libraryOpenerRef,
  onLibraryReady,
  onHeader,
}: {
  db: Db;
  userId: string;
  /** Filled in with how to open "Rules library", for the account ⋯ menu. */
  libraryOpenerRef?: { current: (() => void) | null };
  /** Told when "Rules library" can open from the ⋯ menu (once the signed-in screens are ready). */
  onLibraryReady?: (yes: boolean) => void;
  /** Told whether the header with the app's name shows: only on Your campaigns (2026-10-23). */
  onHeader?: (show: boolean) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([loadCurrentUser(db), loadMyProfile(db, userId)])
      .then(([user, profile]) => {
        if (!current) return;
        if (user && profile) setLoaded({ user, profile });
        else setFailed(true);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [db, userId, version]);

  const reload = () => {
    setFailed(false);
    setVersion((v) => v + 1);
  };

  if (failed) {
    return (
      <section className="auth">
        <p className="form-error" role="alert">
          Couldn't load your account. Check your connection and try again.
        </p>
        <button type="button" className="button-primary" onClick={reload}>
          Try again
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={() => {
          // cw-13: picks kept on this device go with the session.
          forgetAllKept();
          void signOut(db);
        }}>
          Sign out
        </button>
      </section>
    );
  }
  if (!loaded) return <p role="status">Opening…</p>;
  if (!loaded.profile.named) return <ChooseName db={db} {...loaded} onDone={reload} />;
  return (
    // Who is signed in, for the phone drawer's foot (slice E).
    <PersonProvider name={loaded.profile.displayName}>
      <Home db={db} initialUser={loaded.user} libraryOpenerRef={libraryOpenerRef} onLibraryReady={onLibraryReady} onHeader={onHeader} />
    </PersonProvider>
  );
}

function Home({
  db,
  initialUser,
  libraryOpenerRef,
  onLibraryReady,
  onHeader,
}: {
  db: Db;
  initialUser: CurrentUser;
  libraryOpenerRef?: { current: (() => void) | null };
  onLibraryReady?: (yes: boolean) => void;
  onHeader?: (show: boolean) => void;
}) {
  const [user, setUser] = useState(initialUser);

  // Fetch the campaign screens in the background, so opening one doesn't wait for the network.
  useEffect(() => {
    for (const screen of [PlayerCampaign, CreateCharacter, GmCampaign, NewCampaign, LibraryScreen]) void screen.preload();
  }, []);

  useEffect(() => {
    onLibraryReady?.(true);
    return () => onLibraryReady?.(false);
  }, [onLibraryReady]);
  const [view, setView] = useState<View>(() => {
    const code = pendingInvite();
    if (code) return { kind: 'join', code };
    // Just reloaded into a new version: back to the screen the person was on (placeOnReload.ts).
    return keptPlace(initialUser.id, initialUser.roles) ?? { kind: 'picker' };
  });
  useEffect(() => placeRestored(), []);
  // Where the person is, for a reload into a new version: a campaign or the Rules library; elsewhere, Your campaigns.
  useEffect(() => {
    notePlace(user.id, view.kind === 'campaign' ? { kind: 'campaign', campaign: view.campaign } : view.kind === 'library' ? view : null);
    return () => notePlace(user.id, null);
  }, [user.id, view]);

  // Before the screen is painted, so the header never flashes above a screen's own top row.
  useLayoutEffect(() => {
    onHeader?.(view.kind === 'picker');
    return () => onHeader?.(true);
  }, [onHeader, view.kind]);

  useEffect(() => {
    if (!libraryOpenerRef) return;
    libraryOpenerRef.current = () => setView({ kind: 'library' });
    return () => {
      libraryOpenerRef.current = null;
    };
  }, [libraryOpenerRef]);

  const toPicker = () => {
    clearPendingInvite();
    setView({ kind: 'picker' });
  };
  const open = async (campaign: OpenCampaign, then: 'campaign' | 'create' = 'campaign') => {
    clearPendingInvite();
    // A campaign just created or joined isn't in the roles loaded at sign-in yet; commands need it there.
    if (user.roles[campaign.id] === undefined) {
      const fresh = await loadCurrentUser(db).catch(() => null);
      if (fresh) setUser(fresh);
    }
    setView({ kind: then, campaign });
  };
  // Retiring or bringing back a campaign: commands need the new state, and the campaign's screens show it.
  const retiredChanged = async (campaign: OpenCampaign, retiredAt: string | null) => {
    const fresh = await loadCurrentUser(db).catch(() => null);
    if (fresh) setUser(fresh);
    setView({ kind: 'campaign', campaign: { ...campaign, retiredAt } });
  };

  switch (view.kind) {
    case 'new':
      return (
        <>
          <TopRow back="Your campaigns" backShort="Campaigns" onBack={toPicker} />
          <NewCampaign db={db} user={user} onCreated={(campaign) => void open(campaign)} onCancel={toPicker} />
        </>
      );
    case 'join':
      return (
        <>
          <TopRow back="Your campaigns" backShort="Campaigns" onBack={toPicker} />
          <JoinCampaign
            db={db}
            user={user}
            code={view.code}
            onJoined={(campaign) => void open(campaign, 'create')}
            onOpen={(campaign) => void open(campaign)}
            onCancel={toPicker}
          />
        </>
      );
    case 'create':
      return (
        <CampaignLog db={db} user={user} campaignId={view.campaign.id}>
          <TopRow campaign={{ db, campaign: view.campaign }} onBack={toPicker} />
          {/* The campaign's ⋯ items inside creation (final draft 9): each saves the picks first, then opens its screen. */}
          <CampaignMenuProvider
            characters={
              <MenuItem icon="characters" onClick={() => setView({ kind: 'campaign', campaign: view.campaign, open: 'list' })}>
                Your characters
              </MenuItem>
            }
            items={
              <MenuItem icon="scales" onClick={() => setView({ kind: 'campaign', campaign: view.campaign, open: 'rules' })}>
                Setting rules
              </MenuItem>
            }
          >
            <CreateCharacter db={db} user={user} campaign={view.campaign} onDone={() => setView({ kind: 'campaign', campaign: view.campaign })} />
          </CampaignMenuProvider>
        </CampaignLog>
      );
    case 'campaign':
      return (
        <CampaignLog key={view.campaign.id} db={db} user={user} campaignId={view.campaign.id}>
          <Messaging db={db} user={user} campaign={view.campaign}>
          {view.campaign.role === 'gm' ? (
        <GmCampaign
          db={db}
          user={user}
          campaign={view.campaign}
          onBack={toPicker}
          onRetiredChange={(retiredAt) => void retiredChanged(view.campaign, retiredAt)}
        />
      ) : (
        <PlayerCampaign
          db={db}
          user={user}
          campaign={view.campaign}
          onCreate={() => setView({ kind: 'create', campaign: view.campaign })}
          onBack={toPicker}
          opening={view.open}
        />
          )}
          </Messaging>
        </CampaignLog>
      );
    case 'library':
      return <LibraryScreen db={db} user={user} onBack={toPicker} />;
    case 'picker':
      return (
        <CampaignPicker
          db={db}
          userId={user.id}
          onOpen={(campaign) => void open(campaign)}
          onNew={() => setView({ kind: 'new' })}
          onInviteCode={(code) => setView({ kind: 'join', code })}
        />
      );
  }
}

function ChooseName({ db, user, profile, onDone }: Loaded & { db: Db; onDone: () => void }) {
  const [name, setName] = useState(profile.displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, renameProfile, { userId: user.id, displayName: name });
    setBusy(false);
    if (result.ok) onDone();
    else setError(result.message);
  }

  return (
    <form className="auth" onSubmit={save} noValidate>
      <h1 className="auth__title">What should we call you?</h1>
      <div className="field">
        <label className="label" htmlFor="your-name">
          Your name
        </label>
        <input
          id="your-name"
          // A table name, never the email (P25, 2026-11-06): "nickname", and a field name that isn't username or email,
          // so a browser's sign-in autofill leaves it alone.
          name="table-name"
          className="field__input"
          type="text"
          autoComplete="nickname"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby="your-name-hint"
        />
        <p id="your-name-hint" className="auth__meta">
          Shown to your GM and fellow players.
        </p>
      </div>
      <ErrorToast message={error} />
      <button type="submit" className="button-primary" aria-busy={busy}>
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
