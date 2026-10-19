"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { allowedDomainsForDisplay, emailAllowed } from "@/lib/access";
import { hashPassword, passwordProblem, verifyDummy, verifyPassword } from "@/lib/password";
import { createSession, destroyAllSessions, destroySession } from "@/lib/session";
import { createToken, findToken } from "@/lib/auth-tokens";
import { clear, hit } from "@/lib/rate-limit";
import { mailAlreadyRegistered, mailNoAccount, mailReset, mailVerify } from "@/lib/email";

export type FormState = { ok?: boolean; message?: string; email?: string } | null;

const MINUTE = 60 * 1000;
const VERIFY_HOURS = 24;
const RESET_HOURS = 1;
const TOO_MANY = "För många försök. Vänta en kvart och försök igen.";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function emailField(formData: FormData): string {
  return field(formData, "email").trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Besökarens IP enligt reverse proxyn. Den sista adressen i X-Forwarded-For är den
 * som proxyn själv lagt till; de tidigare kan besökaren ha hittat på.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "okänd";
}

/** Bara interna sökvägar, så att inloggningen inte kan skicka vidare till en annan webbplats. */
function safeCallback(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/utlagg";
}

async function notAllowedMessage(): Promise<string> {
  const domains = await allowedDomainsForDisplay();
  return domains.length > 0
    ? `Den adressen kan inte användas här. Använd din föreningsadress (${domains.join(", ")}), eller hör av dig till ekonomi@mtek.chalmers.se.`
    : "Den adressen kan inte användas här. Hör av dig till ekonomi@mtek.chalmers.se.";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailField(formData);
  const password = field(formData, "password");
  const remember = formData.get("remember") === "on";
  const ip = await clientIp();

  if (!hit(`login:ip:${ip}`, 50, 15 * MINUTE) || !hit(`login:${email}`, 10, 15 * MINUTE)) {
    return { message: TOO_MANY, email };
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : await verifyDummy(password);
  if (!user || !ok) {
    return { message: "Fel e-postadress eller lösenord.", email };
  }
  if (!(await emailAllowed(email))) {
    return { message: await notAllowedMessage(), email };
  }

  clear(`login:${email}`);
  await createSession(user.id, remember);
  redirect(safeCallback(field(formData, "callbackUrl")));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailField(formData);
  const password = field(formData, "password");
  if (!validEmail(email)) return { message: "Ange en giltig e-postadress.", email };
  if (!(await emailAllowed(email))) return { message: await notAllowedMessage(), email };
  const problem = passwordProblem(password, field(formData, "password2"));
  if (problem) return { message: problem, email };

  const ip = await clientIp();
  if (!hit(`mail:ip:${ip}`, 20, 15 * MINUTE) || !hit(`mail:${email}`, 3, 15 * MINUTE)) {
    return { message: TOO_MANY, email };
  }

  // Samma svar oavsett om kontot redan finns, så att sidan inte avslöjar vilka adresser som har konto.
  const done: FormState = {
    ok: true,
    message: `Vi har skickat ett mail till ${email}. Öppna länken i det för att aktivera kontot. Hittar du det inte, titta i skräpposten.`,
  };
  const existing = await prisma.user.findUnique({ where: { email }, select: { passwordHash: true } });
  try {
    if (existing?.passwordHash) {
      await mailAlreadyRegistered(email);
    } else {
      // Lösenordet sparas på länken och flyttas till kontot först när adressen är bekräftad.
      const url = await createToken("VERIFY", email, "/login/bekrafta", VERIFY_HOURS, await hashPassword(password));
      await mailVerify(email, url);
    }
  } catch (err) {
    console.error("[konto] kunde inte skicka mail:", err);
    return { message: "Mailet kunde inte skickas. Försök igen om en stund eller kontakta ekonomi@mtek.chalmers.se.", email };
  }
  return done;
}

export async function confirmAction(formData: FormData): Promise<void> {
  const t = await findToken("VERIFY", field(formData, "token"));
  if (!t?.passwordHash) redirect("/login/bekrafta?ogiltig=1");
  if (!(await emailAllowed(t.email))) redirect("/login/bekrafta?ogiltig=1");

  const user = await prisma.user.upsert({
    where: { email: t.email },
    update: { passwordHash: t.passwordHash, emailVerified: new Date() },
    create: { email: t.email, passwordHash: t.passwordHash, emailVerified: new Date() },
  });
  await prisma.authToken.deleteMany({ where: { email: t.email, type: "VERIFY" } });
  // Lösenordet kan ha bytts, så eventuella gamla inloggningar avslutas.
  await destroyAllSessions(user.id);
  redirect("/login?bekraftad=1");
}

export async function forgotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailField(formData);
  if (!validEmail(email)) return { message: "Ange en giltig e-postadress.", email };
  const ip = await clientIp();
  if (!hit(`mail:ip:${ip}`, 20, 15 * MINUTE) || !hit(`mail:${email}`, 3, 15 * MINUTE)) {
    return { message: TOO_MANY, email };
  }

  const done: FormState = {
    ok: true,
    message: `Om adressen får användas här har vi skickat ett mail till ${email} med en länk för att välja nytt lösenord. Länken gäller i en timme.`,
  };
  if (!(await emailAllowed(email))) return done;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  try {
    if (user) {
      const url = await createToken("RESET", email, "/login/nytt-losenord", RESET_HOURS);
      await mailReset(email, url);
    } else {
      await mailNoAccount(email);
    }
  } catch (err) {
    console.error("[konto] kunde inte skicka mail:", err);
    return { message: "Mailet kunde inte skickas. Försök igen om en stund eller kontakta ekonomi@mtek.chalmers.se.", email };
  }
  return done;
}

export async function resetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await findToken("RESET", field(formData, "token"));
  if (!t) return { message: "Länken är ogiltig eller har gått ut. Be om en ny under ”Glömt lösenord”." };
  const password = field(formData, "password");
  const problem = passwordProblem(password, field(formData, "password2"));
  if (problem) return { message: problem };

  const user = await prisma.user.findUnique({ where: { email: t.email } });
  if (!user) return { message: "Kontot finns inte längre." };
  await prisma.user.update({
    where: { id: user.id },
    // Den som kan öppna länken har tillgång till adressen, så den räknas som bekräftad.
    data: { passwordHash: await hashPassword(password), emailVerified: user.emailVerified ?? new Date() },
  });
  await prisma.authToken.deleteMany({ where: { email: t.email } });
  // Alla inloggningar avslutas, så att en tidigare innehavare av adressen loggas ut.
  await destroyAllSessions(user.id);
  redirect("/login?nytt=1");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
