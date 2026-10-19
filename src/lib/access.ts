import "server-only";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/config";

/**
 * Vem som får skapa konto och logga in:
 *  - sektionskassörerna i ADMIN_EMAILS,
 *  - kommittékassörerna (adresserna under Kassör → Kommittéer),
 *  - adresser på domänerna i ALLOWED_EMAIL_DOMAINS (.env),
 *  - adresser och domäner som lagts till under Kassör → Inställningar → Vem får skapa konto.
 *
 * Är både .env-listan och listan i databasen tomma släpps alla adresser in.
 */

/** Domänerna i ALLOWED_EMAIL_DOMAINS. */
export function envDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => normalizeEntry(d))
    .filter(Boolean);
}

/** Gemener, utan blanksteg och inledande @. */
export function normalizeEntry(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

/** Är värdet en giltig domän (marm.se) eller adress (namn@marm.se)? */
export function validEntry(value: string): boolean {
  return /^([^\s@]+@)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(value);
}

function domainMatches(domain: string, allowed: string): boolean {
  // Underdomäner räknas med, så "mtek.chalmers.se" släpper även in "x.mtek.chalmers.se".
  return domain === allowed || domain.endsWith(`.${allowed}`);
}

export async function emailAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const addr = email.toLowerCase();
  if (isAdminEmail(addr)) return true;
  const domain = addr.split("@")[1] ?? "";

  const env = envDomains();
  if (env.some((d) => domainMatches(domain, d))) return true;

  const [entries, treasurer] = await Promise.all([
    prisma.allowedEmail.findMany({ select: { value: true } }),
    prisma.committee.findFirst({ where: { treasurerEmail: addr, active: true }, select: { id: true } }),
  ]);
  if (treasurer) return true;
  if (env.length === 0 && entries.length === 0) return true;
  return entries.some((e) => (e.value.includes("@") ? e.value === addr : domainMatches(domain, e.value)));
}

/** Domänerna som visas för den som försöker skapa konto med en adress som inte släpps in. */
export async function allowedDomainsForDisplay(): Promise<string[]> {
  const entries = await prisma.allowedEmail.findMany({ select: { value: true } });
  const db = entries.map((e) => e.value).filter((v) => !v.includes("@"));
  return [...new Set([...envDomains(), ...db])];
}
