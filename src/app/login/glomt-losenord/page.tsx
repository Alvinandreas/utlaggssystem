import { ForgotForm } from "@/components/AuthForms";

export const metadata = { title: "Glömt lösenord" };

export default function ForgotPage() {
  return (
    <main className="container narrow">
      <div className="card accent" style={{ maxWidth: 480, margin: "2rem auto" }}>
        <h1>Glömt lösenordet?</h1>
        <p className="muted">
          Ange adressen du loggar in med så skickar vi en länk där du väljer ett nytt lösenord. Har du tagit över
          en föreningsadress från din företrädare gör du likadant.
        </p>
        <ForgotForm />
      </div>
    </main>
  );
}
