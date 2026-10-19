import "server-only";

// Enkel begränsning av antal försök per nyckel (adress eller IP) inom ett tidsfönster.
// Ligger i minnet, vilket räcker eftersom appen körs som en enda process. Räknarna
// nollställs vid omstart.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Räknar ett försök. Returnerar false om gränsen redan är nådd. */
export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

/** Nollställer en nyckel, t.ex. efter lyckad inloggning. */
export function clear(key: string): void {
  buckets.delete(key);
}
