import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { currentSessionUser } from "@/lib/session";
import { emailAllowed } from "@/lib/access";
import { isAdminEmail } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  /** Sektionskassör (finns i ADMIN_EMAILS): ser och hanterar allt, sköter inställningar. */
  isAdmin: boolean;
  /** Id på kommittéer där användaren är registrerad kassör. */
  treasurerOf: string[];
  /** Har rätt att hantera utlägg (sektionskassör eller kommittékassör). */
  isTreasurer: boolean;
};

/** Inloggad användare, eller null. Cachas per förfrågan. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const u = await currentSessionUser();
  if (!u) return null;
  const email = u.email.toLowerCase();
  // Tas en domän eller adress bort ur listan över tillåtna gäller det även den som redan är inloggad.
  if (!(await emailAllowed(email))) return null;
  const isAdmin = isAdminEmail(email);
  const committees = await prisma.committee.findMany({
    where: { treasurerEmail: email, active: true },
    select: { id: true },
  });
  const treasurerOf = committees.map((c) => c.id);
  return {
    id: u.id,
    email,
    name: u.name ?? email,
    image: u.image ?? null,
    isAdmin,
    treasurerOf,
    isTreasurer: isAdmin || treasurerOf.length > 0,
  };
});

/** Kräver inloggning, annars skickas användaren till inloggningssidan. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Kräver kassörsbehörighet (sektionskassör eller kommittékassör). */
export async function requireTreasurer(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isTreasurer) redirect("/utlagg?behorighet=saknas");
  return user;
}

/** Kräver sektionskassör (ADMIN_EMAILS). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/utlagg?behorighet=saknas");
  return user;
}

/** Får användaren hantera ett visst utlägg? */
export function canManage(user: SessionUser, expense: { committeeId: string | null }): boolean {
  if (user.isAdmin) return true;
  return Boolean(expense.committeeId && user.treasurerOf.includes(expense.committeeId));
}

/** Prisma-filter för de utlägg användaren får se i kassörsvyn. */
export function manageableFilter(user: SessionUser): { committeeId?: { in: string[] } } {
  if (user.isAdmin) return {};
  return { committeeId: { in: user.treasurerOf } };
}
