import { useContext, useId } from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { BuildContext } from './AppUpdate.tsx';
import { FONT_CREDITS, aboutVersionLine, creditsLine, iconCreditName, iconCredits, type FontCredit, type IconCredit } from './aboutCredits.ts';
import './AboutThisApp.css';

// "About this app" (ds-6a, ds-6b; plan dec-9 piece B; pictures december/08-01 to 08-03, approved 2026-11-12): opened
// from the menu's item above Sign out. The sheet belongs to the app, so no campaign's name sits over its title. One
// quiet line, the app's name and this build's version; then Credits: its one line, a row for each icon (the icon small
// at the row's start, its plain name, its author, where it is from, the licence as a link), a dotted rule, and the
// fonts with theirs. The head and ✕ stay in view; the rows scroll under them. ✕, Escape or a tap outside closes it.

/** A licence's name as a link, kept whole on its line (picture 08-03). */
function LicenceLink({ licence }: { licence: { name: string; url: string } }) {
  return (
    <a className="about__link" href={licence.url} target="_blank" rel="noopener noreferrer">
      {licence.name}
    </a>
  );
}

function IconRow({ icon }: { icon: IconCredit }) {
  return (
    <li className="about__row">
      <span className={icon.mirrored ? 'about__icon about__icon--mirrored' : 'about__icon'}>
        <Icon name={icon.name} size={20} />
      </span>
      <span className="about__words">
        <strong>{iconCreditName(icon)}:</strong> {icon.author.name}, {icon.source.name}, <LicenceLink licence={icon.licence} />
      </span>
    </li>
  );
}

function FontRow({ font }: { font: FontCredit }) {
  return (
    <li className="about__row about__row--font">
      <span className="about__words">
        <strong>{font.family}:</strong> {font.authors}, <LicenceLink licence={font.licence} />
      </span>
    </li>
  );
}

/** The sheet's content, without the sheet (the gallery draws it in place with `preview`). */
export function AboutThisApp({ onClose, preview = false, icons = iconCredits(), fonts = FONT_CREDITS }: { onClose: () => void; preview?: boolean; icons?: readonly IconCredit[]; fonts?: readonly FontCredit[] }) {
  const build = useContext(BuildContext);
  const headingId = useId();
  return (
    <Dialog label="About this app" onClose={onClose} side preview={preview}>
      <div className="about">
        <p className="about__version">{aboutVersionLine(build)}</p>
        <h3 id={headingId} className="about__heading">
          Credits
        </h3>
        <p className="about__line">{creditsLine(icons)}</p>
        {/* A region of its own that scrolls, reachable by keyboard (Tab), named by the heading. */}
        <div className="about__scroll" role="region" aria-labelledby={headingId} tabIndex={0}>
          <ul className="about__list" aria-label="Icons">
            {icons.map((icon) => (
              <IconRow key={icon.name} icon={icon} />
            ))}
          </ul>
          <ul className="about__list about__list--fonts" aria-label="Fonts">
            {fonts.map((font) => (
              <FontRow key={font.pkg} font={font} />
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
