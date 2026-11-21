import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { CODE_LENGTH, RESEND_SECONDS, codeFromAddress, isCompleteCode, normalizeCode, normalizeEmail, sendCode, verifyCode } from '../core/auth.ts';
import type { Db } from '../core/supabase.ts';
import { pendingInvite } from './pendingInvite.ts';
import './SignIn.css';

// Sign in by email code: enter email → enter the 6-digit code. Matches the approved SignIn design.
export function SignIn({ db }: { db: Db }) {
  // A code carried in the address (P1, 2026-11-06), read once: filled in and sent at once when the link names the
  // email; otherwise (a link opened in a fresh browser) the email is asked first and finishes with the same code.
  const [fromLink] = useState(() => (typeof window !== 'undefined' ? codeFromAddress(window.location.search) : null));
  const [step, setStep] = useState<'email' | 'code'>(fromLink?.email ? 'code' : 'email');
  const [email, setEmail] = useState(fromLink?.email ?? '');
  const [code, setCode] = useState(fromLink?.code ?? '');
  const [busy, setBusy] = useState(false);
  const blocked = useBlockedSheet();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(fromLink && !fromLink.email ? 'Enter your email to finish signing in with the code from your email.' : null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [invite] = useState(pendingInvite);

  // The code leaves the address at once, so a reload or a shared link never sends it again; then, with the email
  // known, it's sent.
  const linkSent = useRef(false);
  useEffect(() => {
    if (!fromLink || linkSent.current) return;
    linkSent.current = true;
    const params = new URLSearchParams(window.location.search);
    params.delete('code');
    params.delete('email');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    if (fromLink.email) void signIn(fromLink.code);
    // Once, on opening: fromLink never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick once a second on the code step, for the "Send a new code" countdown.
  useEffect(() => {
    if (step !== 'code') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function emailMeACode(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    // A code from the link is waiting (a fresh browser): the email finishes it; no new code is sent.
    if (fromLink && !fromLink.email && step === 'email' && code === fromLink.code) {
      setStep('code');
      setNotice(null);
      return void signIn(code, email);
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await sendCode(db, email);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const sentAt = Date.now();
    setNow(sentAt);
    setResendAt(sentAt + RESEND_SECONDS * 1000);
    if (step === 'code') {
      setCode('');
      setNotice('We sent a new code.');
    } else {
      setStep('code');
    }
  }

  async function signIn(candidate: string, emailFor?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await verifyCode(db, emailFor ?? email, candidate);
    setBusy(false);
    // On success the session watcher switches screens; nothing more to do here. A code from the link stays filled in
    // when it fails (P1), so the error is read beside it; a typed one is cleared for the next try.
    if (!result.ok) {
      setError(fromLink && candidate === fromLink.code ? `${result.message} The code from your email is still below: check it, or send a new one.` : result.message);
      if (!(fromLink && candidate === fromLink.code)) setCode('');
    }
  }

  function typeCode(value: string) {
    const digits = normalizeCode(value);
    setCode(digits);
    // Fewer taps: sign in as soon as all six digits are in (typed, pasted or filled from the email).
    if (isCompleteCode(digits)) void signIn(digits);
  }

  function useDifferentEmail() {
    setStep('email');
    setCode('');
    setError(null);
    setNotice(null);
  }

  // The email step finishing a code from the link (a fresh browser): its button signs in.
  const finishing = !!fromLink && !fromLink.email && code === fromLink.code;
  if (step === 'email') {
    return (
      <form className="auth" onSubmit={emailMeACode} noValidate>
        {invite && (
          <p>
            Sign in to join with invite code <strong>{invite}</strong>.
          </p>
        )}
        <div className="field">
          <label className="label" htmlFor="sign-in-email">
            Email
          </label>
          <input
            id="sign-in-email"
            className="field__input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error ? 'sign-in-error' : undefined}
          />
        </div>
        {error && (
          <p id="sign-in-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="auth__meta" role="status">
            {notice}
          </p>
        )}
        <button type="submit" className="button-primary" aria-busy={busy}>
          {finishing ? (busy ? 'Signing in…' : 'Sign in') : busy ? 'Sending…' : 'Email me a code'}
        </button>
      </form>
    );
  }

  return (
    <form
      className="auth"
      onSubmit={(event) => {
        event.preventDefault();
        void signIn(code);
      }}
      noValidate
    >
      <h1 className="auth__title">Check your email</h1>
      <p>
        Enter the {CODE_LENGTH}-digit code we sent to <strong className="auth__email">{normalizeEmail(email)}</strong>.
      </p>
      <div className="field">
        <label className="label" htmlFor="sign-in-code">
          Sign-in code
        </label>
        <input
          id="sign-in-code"
          className="field__input field__input--code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={code}
          onChange={(event) => typeCode(event.target.value)}
          aria-describedby={error ? 'sign-in-error' : undefined}
        />
      </div>
      {error && (
        <p id="sign-in-error" className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="auth__meta" role="status">
          {notice}
        </p>
      )}
      <button type="submit" className="button-primary" aria-busy={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="auth__links">
        <button
          type="button"
          className="button-secondary button-secondary--small"
          aria-busy={busy}
          onClick={() => (secondsLeft > 0 ? blocked.explain('Wait a moment', 'A new code can be sent when the countdown on the button ends. The last code still works until then.') : void emailMeACode())}
        >
          {secondsLeft > 0 ? `Send a new code (${secondsLeft}s)` : 'Send a new code'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={useDifferentEmail}>
          Use a different email
        </button>
      </div>
      {blocked.sheet}
    </form>
  );
}
