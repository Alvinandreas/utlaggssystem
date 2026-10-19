import Link from "next/link";
import { findToken } from "@/lib/auth-tokens";
import { ResetForm } from "@/components/AuthForms";

export const metadata = { title: "Nytt lösenord" };

export default async function ResetPage({ searchParams }: PageProps<"/login/nytt-losenord">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const valid = await findToken("RESET", token);

  return (
    <main className="container narrow">
      <div className="card accent" style={{ maxWidth: 480, margin: "2rem auto" }}>
        <h1>Välj nytt lösenord</h1>
        {valid ? (
          <>
            <p className="muted">
              För <strong>{valid.email}</strong>. Alla andra inloggningar på kontot loggas ut när lösenordet byts.
            </p>
            <ResetForm token={token} email={valid.email} />
          </>
        ) : (
          <>
            <div className="alert error">
              <p>Länken är ogiltig, redan använd eller har gått ut (den gäller i en timme).</p>
            </div>
            <p className="auth-links small">
              <Link href="/login/glomt-losenord">Be om en ny länk</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
