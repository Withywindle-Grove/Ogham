import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/fonts.css';
import './ui/tokens.css';
import './ui/base.css';
import './ui/buttons.css';
import { applyTextSize, getTextSize } from './ui/textSize.ts';
import { applyThemeChoice, getThemeChoice } from './ui/theme.ts';
import { App } from './app/App.tsx';
import { registerSW } from 'virtual:pwa-register';
import { keepAppUpdated } from './app/appUpdates.ts';
import { rememberInviteFromAddress } from './app/pendingInvite.ts';

applyThemeChoice(getThemeChoice());
applyTextSize(getTextSize());
// An invite link (/join/CODE) is read once, before anything else, so it survives signing in.
rememberInviteFromAddress();
// Look for a new version whenever the app comes back on screen, and switch at a safe moment.
keepAppUpdated(registerSW);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
