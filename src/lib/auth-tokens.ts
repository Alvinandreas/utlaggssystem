import "server-only";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/email";
import { randomToken, sha256 } from "@/lib/session";

// Engångslänkar som skickas med mail. Bara en hash av länkens värde sparas.

export type TokenType = "VERIFY" | "RESET";

/** Skapar en engångslänk och returnerar dess fullständiga adress. */
export async function createToken(type: TokenType, email: string, path: string, hours: number, passwordHash?: string): Promise<string> {
  const token = randomToken();
  await prisma.authToken.create({
    data: { tokenHash: sha256(token), type, email, passwordHash, expires: new Date(Date.now() + hours * 60 * 60 * 1000) },
  });
  const url = appUrl(`${path}?token=${encodeURIComponent(token)}`);
  if (process.env.NODE_ENV !== "production") console.log(`[konto] ${type} ${email}: ${url}`);
  return url;
}

/** Giltig engångslänk av rätt typ, eller null. Förbrukar den inte. */
export async function findToken(type: TokenType, token: string) {
  if (!token) return null;
  const t = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== type || t.expires < new Date()) return null;
  return t;
}
