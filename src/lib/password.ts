import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/config";

// Lösenord lagras som scrypt-hash: "scrypt$N$r$p$<salt>$<hash>" (base64).
// Parametrarna sparas i strängen så att de kan skärpas senare utan att gamla
// lösenord slutar fungera.

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
// scrypt behöver 128 * N * r byte, vilket är strax över Nodes standardtak på 32 MB.
const MAXMEM = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummy: Promise<string> | null = null;

/**
 * Kör en hashjämförelse även när kontot inte finns, så att svarstiden inte
 * avslöjar vilka adresser som har konto.
 */
export async function verifyDummy(password: string): Promise<false> {
  dummy ??= hashPassword("dummy-lösenord-som-aldrig-matchar");
  await verifyPassword(password, await dummy);
  return false;
}

/** Felmeddelande om lösenordet inte duger, annars null. */
export function passwordProblem(password: string, repeat: string): string | null {
  if (password.length < PASSWORD_MIN) return `Lösenordet måste vara minst ${PASSWORD_MIN} tecken.`;
  if (password.length > PASSWORD_MAX) return `Lösenordet får vara högst ${PASSWORD_MAX} tecken.`;
  if (password !== repeat) return "Lösenorden stämmer inte överens.";
  return null;
}
