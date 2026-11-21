// The component gallery's entry (gallery.html). See Gallery.tsx.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/fonts.css';
import '../ui/tokens.css';
import '../ui/base.css';
import '../ui/buttons.css';
import '../app/App.css';
import { Gallery } from './Gallery.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
