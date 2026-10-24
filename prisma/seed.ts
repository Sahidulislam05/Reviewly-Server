import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const { SEED_MENTOR_NAME = "Mentor", SEED_MENTOR_EMAIL, SEED_MENTOR_PASSWORD } = process.env;
if (!SEED_MENTOR_EMAIL || !SEED_MENTOR_PASSWORD) {
  throw new Error("Set SEED_MENTOR_EMAIL and SEED_MENTOR_PASSWORD in .env");
}

// Upsert by email: running the seed twice never creates a second mentor.
const email = SEED_MENTOR_EMAIL.toLowerCase();
const mentor = await prisma.user.upsert({
  where: { email },
  update: { role: "MENTOR" },
  create: { name: SEED_MENTOR_NAME, email, passwordHash: await bcrypt.hash(SEED_MENTOR_PASSWORD, 12), role: "MENTOR" },
  select: { email: true, role: true },
});
console.log(`Seeded ${mentor.role}: ${mentor.email}`);
await prisma.$disconnect();
