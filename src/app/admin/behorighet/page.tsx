import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { envDomains } from "@/lib/access";
import { adminEmails } from "@/lib/config";
import { addAllowedEmail, removeAllowedEmail } from "../actions";

export const metadata = { title: "Vem får skapa konto" };

const MESSAGES: Record<string, string> = {
  sparat: "Sparat.",
  borttagen: "Borttagen.",
};
const ERRORS: Record<string, string> = {
  format: "Ange en domän (marm.se) eller en hel adress (namn@marm.se).",
};

export default async function AccessPage({ searchParams }: PageProps<"/admin/behorighet">) {
  await requireAdmin();
  const sp = await searchParams;
  const [entries, treasurers] = await Promise.all([
    prisma.allowedEmail.findMany({ orderBy: { value: "asc" } }),
    prisma.committee.findMany({
      where: { treasurerEmail: { not: null }, active: true },
      select: { name: true, treasurerEmail: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const env = envDomains();
  const flash = Object.keys(MESSAGES).find((k) => sp[k] === "1");
  const error = typeof sp.fel === "string" ? ERRORS[sp.fel] : null;

  return (
    <main className="container narrow">
      <div className="page-head">
        <div>
          <h1>Vem får skapa konto</h1>
          <p className="muted" style={{ margin: 0 }}>
            Bara adresser som släpps in här kan skapa konto, logga in och göra utlägg. Tas en domän eller adress
            bort loggas de som använder den ut direkt.
          </p>
        </div>
        <Link href="/admin/installningar" className="btn small">
          ← Inställningar
        </Link>
      </div>

      {flash && (
        <div className="alert success">
          <p>{MESSAGES[flash]}</p>
        </div>
      )}
      {error && (
        <div className="alert error">
          <p>{error}</p>
        </div>
      )}

      <div className="card">
        <h2>Domäner och adresser</h2>
        {entries.length === 0 ? (
          <p className="muted">Inga tillagda här ännu.</p>
        ) : (
          <ul className="plain-list">
            {entries.map((e) => (
              <li key={e.id}>
                <form action={removeAllowedEmail} className="btn-row" style={{ justifyContent: "space-between" }}>
                  <input type="hidden" name="id" value={e.id} />
                  <span>
                    <strong className="mono">{e.value}</strong>
                    {e.note && <span className="muted"> · {e.note}</span>}
                  </span>
                  <button className="btn small ghost" type="submit">
                    Ta bort
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addAllowedEmail} style={{ marginTop: "1rem" }}>
          <div className="row cols-2">
            <div className="field compact">
              <label htmlFor="value">Domän eller adress</label>
              <input id="value" className="input mono" name="value" required placeholder="marm.se" />
            </div>
            <div className="field compact">
              <label htmlFor="note">Anteckning (frivillig)</label>
              <input id="note" className="input" name="note" placeholder="MARM" />
            </div>
          </div>
          <button className="btn primary" type="submit" style={{ marginTop: "0.75rem" }}>
            Lägg till
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Släpps alltid in</h2>
        <dl className="dl">
          <dt>Domäner i .env</dt>
          <dd>{env.length > 0 ? env.join(", ") : "Inga (ALLOWED_EMAIL_DOMAINS är tomt)"}</dd>
          <dt>Sektionskassörer</dt>
          <dd>{adminEmails().join(", ") || "Inga"}</dd>
          <dt>Kommittékassörer</dt>
          <dd>
            {treasurers.length > 0
              ? treasurers.map((t) => `${t.treasurerEmail} (${t.name})`).join(", ")
              : "Inga"}{" "}
            <Link href="/admin/kommitteer" className="small">
              Ändra under Kommittéer
            </Link>
          </dd>
        </dl>
        {env.length === 0 && entries.length === 0 && (
          <div className="alert warn" style={{ marginTop: "1rem" }}>
            <p>Båda listorna är tomma, så just nu kan vem som helst skapa konto.</p>
          </div>
        )}
      </div>
    </main>
  );
}
