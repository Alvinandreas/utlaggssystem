import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/dal";
import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Skapa konto" };

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/utlagg");
  return (
    <main className="container narrow">
      <div className="card accent" style={{ maxWidth: 480, margin: "2rem auto" }}>
        <h1>Skapa konto</h1>
        <p className="muted">
          Använd din föreningsadress, t.ex. bokning.miss@mtek.chalmers.se. Du får ett mail med en länk som
          aktiverar kontot.
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
