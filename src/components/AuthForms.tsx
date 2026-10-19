"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotAction, loginAction, registerAction, resetAction, type FormState } from "@/app/login/actions";
import { PASSWORD_MIN } from "@/lib/config";

function Message({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <div className={`alert ${state.ok ? "success" : "error"}`} role={state.ok ? "status" : "alert"}>
      <p>{state.message}</p>
    </div>
  );
}

function EmailField({ defaultValue, autoFocus }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <div className="field">
      <label htmlFor="email">E-post</label>
      <input
        className="input"
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        placeholder="kassor.miss@mtek.chalmers.se"
      />
    </div>
  );
}

function NewPasswordFields() {
  return (
    <>
      <div className="field">
        <label htmlFor="password">Lösenord</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} />
        <p className="help">Minst {PASSWORD_MIN} tecken.</p>
      </div>
      <div className="field">
        <label htmlFor="password2">Upprepa lösenordet</label>
        <input className="input" id="password2" name="password2" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} />
      </div>
    </>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action}>
      <Message state={state} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <EmailField defaultValue={state?.email} autoFocus />
      <div className="field">
        <label htmlFor="password">Lösenord</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label className="checkbox">
          <input type="checkbox" name="remember" />
          <span>Håll mig inloggad</span>
        </label>
      </div>
      <button className="btn primary block" type="submit" disabled={pending}>
        {pending ? "Loggar in…" : "Logga in"}
      </button>
      <p className="auth-links small">
        <Link href="/login/glomt-losenord">Glömt lösenordet?</Link>
        <Link href="/login/skapa-konto">Skapa konto</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action}>
      <Message state={state} />
      <EmailField defaultValue={state?.email} autoFocus />
      <NewPasswordFields />
      <button className="btn primary block" type="submit" disabled={pending}>
        {pending ? "Skapar konto…" : "Skapa konto"}
      </button>
      <p className="auth-links small">
        <Link href="/login">Har du redan ett konto? Logga in</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action}>
      <Message state={state} />
      <EmailField defaultValue={state?.email} autoFocus />
      <button className="btn primary block" type="submit" disabled={pending}>
        {pending ? "Skickar…" : "Skicka länk"}
      </button>
      <p className="auth-links small">
        <Link href="/login">Tillbaka till inloggningen</Link>
      </p>
    </form>
  );
}

export function ResetForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(resetAction, null);
  return (
    <form action={action}>
      <Message state={state} />
      <input type="hidden" name="token" value={token} />
      {/* Hjälper lösenordshanterare att spara det nya lösenordet på rätt konto. */}
      <input type="hidden" name="email" value={email} autoComplete="username" />
      <NewPasswordFields />
      <button className="btn primary block" type="submit" disabled={pending}>
        {pending ? "Sparar…" : "Spara nytt lösenord"}
      </button>
    </form>
  );
}
