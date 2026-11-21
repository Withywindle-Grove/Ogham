import { useState } from 'react';
import packSpec from '../../docs/07-content-packs.md?raw';
import { convertInstructions } from '../modules/library/convertInstructions.ts';
import { copyText } from './clipboard.ts';
import { TopRow } from './TopRow.tsx';

// Rules library → Convert with an AI: the instructions to paste into an AI chat with your own book, so it
// writes a pack to import here. The app itself never calls an AI.
const INSTRUCTIONS = convertInstructions(packSpec);

export function ConvertWithAi({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="library">
      <TopRow back="Rules library" onBack={onBack} />
      <h1 className="library__title">Convert with an AI</h1>
      <p>
        To turn a book you own into setting rules: open Claude, ChatGPT or another AI chat, attach the pages you want (one section
        at a time works best), and paste these instructions. Save its answer as a .json file, then use Import a file.
      </p>
      {INSTRUCTIONS ? (
        <>
          <div className="library__actions">
            <button
              type="button"
              className="button-primary"
              onClick={async () =>
                setMessage((await copyText(INSTRUCTIONS)) ? 'Instructions copied.' : "Couldn't copy. Select the instructions below and copy them by hand.")
              }
            >
              Copy the instructions
            </button>
          </div>
          {message && (
            <p className="library__notice" role="status">
              {message}
            </p>
          )}
          <pre className="library__instructions" tabIndex={0} aria-label="The instructions">
            {INSTRUCTIONS}
          </pre>
        </>
      ) : (
        <p className="form-error" role="alert">
          The instructions are missing from this version of the app.
        </p>
      )}
      <p className="auth__meta">Packs stay private to your account. Keep to what your table needs: names, numbers and short notes.</p>
    </section>
  );
}
