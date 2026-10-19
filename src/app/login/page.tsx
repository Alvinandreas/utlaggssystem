import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/dal";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Logga in" };

const FLASH: Record<string, string> = {
  bekraftad: "Din e-postadress är bekräftad och kontot är aktiverat. Logga in med ditt lösenord.",
  nytt: "Lösenordet är bytt. Logga in med ditt nya lösenord.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getSessionUser();
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/utlagg";
  if (user) redirect(callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/utlagg");
  const flash = Object.keys(FLASH).find((k) => params[k] === "1");

  return (
    <main className="container narrow">
      <div className="card accent" style={{ maxWidth: 480, margin: "2rem auto" }}>
        <h1>Logga in</h1>
        <p className="muted">Logga in med din föreningsadress för att göra utlägg och följa dina tidigare utlägg.</p>
        {flash && (
          <div className="alert success">
            <p>{FLASH[flash]}</p>
          </div>
        )}
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
