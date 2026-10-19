import Link from "next/link";
import { findToken } from "@/lib/auth-tokens";
import { confirmAction } from "../actions";

export const metadata = { title: "Bekräfta e-postadress" };

export default async function ConfirmPage({ searchParams }: PageProps<"/login/bekrafta">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  // Länken förbrukas först när knappen trycks, så att program som förhandsgranskar
  // länkar i mail inte råkar aktivera kontot.
  const valid = params.ogiltig !== "1" && (await findToken("VERIFY", token));

  return (
    <main className="container narrow">
      <div className="card accent" style={{ maxWidth: 480, margin: "2rem auto" }}>
        <h1>Bekräfta e-postadress</h1>
        {valid ? (
          <form action={confirmAction}>
            <p>
              Aktivera kontot för <strong>{valid.email}</strong>.
            </p>
            <input type="hidden" name="token" value={token} />
            <button className="btn primary block" type="submit">
              Aktivera kontot
            </button>
          </form>
        ) : (
          <>
            <div className="alert error">
              <p>Länken är ogiltig, redan använd eller har gått ut (den gäller i ett dygn).</p>
            </div>
            <p className="auth-links small">
              <Link href="/login">Logga in</Link>
              <Link href="/login/skapa-konto">Skapa konto igen</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
