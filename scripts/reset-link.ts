/**
 * Skapar en länk för att välja lösenord, utan att något mail skickas. Reservväg om
 * mailutskicket inte fungerar, t.ex. vid första driftsättningen.
 *
 * Kör på servern: npm run auth:link -- ekonomi@mtek.chalmers.se
 * (i Docker: docker exec -it utlagg npm run auth:link -- ekonomi@mtek.chalmers.se)
 *
 * Kontot skapas om det inte finns. Länken gäller i 24 timmar.
 */
import { config } from "dotenv";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

config();

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Ange en e-postadress: npm run auth:link -- namn@mtek.chalmers.se");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  const token = randomBytes(32).toString("base64url");
  await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
  await prisma.authToken.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      type: "RESET",
      email,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await prisma.$disconnect();

  const base = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`\nÖppna länken och välj lösenord för ${email} (gäller i 24 timmar):\n`);
  console.log(`${base}/login/nytt-losenord?token=${token}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
