import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Sessioner sparas i databasen så att de kan avslutas på serversidan, t.ex. när
// en föreningsadress byter innehavare och den nya personen återställer lösenordet.

const COOKIE = "utlagg_session";
/** "Håll mig inloggad": ett år. */
export const REMEMBER_DAYS = 365;
/** Utan "Håll mig inloggad" gäller kakan tills webbläsaren stängs, men högst så här länge. */
const SHORT_HOURS = 24;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function secureCookies(): boolean {
  return (process.env.AUTH_URL ?? "").startsWith("https://");
}

/** Skapar en session och sätter kakan. Får bara anropas från Server Actions. */
export async function createSession(userId: string, remember: boolean): Promise<void> {
  const token = randomToken();
  const expires = remember
    ? new Date(Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + SHORT_HOURS * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken: sha256(token), userId, expires, remember } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    // Utan maxAge blir det en sessionskaka som försvinner när webbläsaren stängs.
    ...(remember ? { maxAge: REMEMBER_DAYS * 24 * 60 * 60 } : {}),
  });
}

/** Inloggad användare enligt kakan, eller null. Cachas per förfrågan. */
export const currentSessionUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
  });
  if (!session || session.expires < new Date()) return null;
  return session.user;
});

/** Loggar ut den här webbläsaren. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { sessionToken: sha256(token) } });
  store.delete(COOKIE);
}

/** Loggar ut användaren överallt. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
