/**
 * Seeds the database with an initial admin account, sample job, and email templates.
 * Run with: npx tsx scripts/seed.ts
 *
 * Credentials are read from env vars:
 *   SEED_ADMIN_EMAIL        (default: admin@vekt.io)
 *   SEED_ADMIN_PASSWORD     (required)
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { DEFAULT_EMAIL_TEMPLATES } from "./email-templates";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@vekt.io";
  const adminRaw = process.env.SEED_ADMIN_PASSWORD;
  if (!adminRaw) {
    console.error("❌ SEED_ADMIN_PASSWORD env var is required. Add it to your .env file.");
    process.exit(1);
  }
  // Seed runs on every container start (SEED_ON_START), so never overwrite or recreate existing data
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log(`─ Admin user exists, skipping admin and sample job: ${adminEmail}`);
  } else {
    const adminPassword = await bcrypt.hash(adminRaw, 10);
    await prisma.user.create({
      data: { email: adminEmail, password: adminPassword, role: "ADMIN" },
    });
    console.log(`✅ Seeded admin user:     ${adminEmail}`);
  }

  // --- Dummy job listing (fresh install only, so a deleted sample job stays deleted) ---
  if (!existingAdmin) {
    await prisma.job.create({
      data: {
        id: "seed-job-caissier",
        slug: "caissier-caissiere",
        title: "Caissier / Caissière",
        description: `Nous recherchons un(e) caissier(ère) souriant(e) et rigoureux(se) pour rejoindre notre équipe en magasin.

**Missions :**
- Accueillir les clients et assurer un passage en caisse rapide et agréable
- Encaisser les achats (espèces, carte bancaire, paiement mobile) et rendre la monnaie
- Gérer l’ouverture et la clôture de caisse, et contrôler le fond de caisse
- Renseigner les clients et traiter les retours ou réclamations simples
- Participer à la mise en rayon et au maintien de la propreté de l’espace de vente

**Profil recherché :**
- Une première expérience en caisse ou dans la vente est un plus
- Aisance avec les chiffres et sens de la rigueur
- Sens du service client, politesse et patience
- Ponctualité et capacité à travailler en horaires décalés (week-ends inclus)

**Atouts appréciés :**
- Maîtrise d’un logiciel de caisse
- Notions d’anglais pour accueillir une clientèle internationale`,
        location: "Sur site",
        isActive: true,
      },
    });
    console.log("✅ Seeded job listing:    Caissier / Caissière");
  }

  // --- Email templates (French defaults, see scripts/email-templates.ts) ---
  for (const t of DEFAULT_EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { type: t.type },
      update: {},
      create: { type: t.type, subject: t.subject, body: t.body },
    });
  }
  console.log("✅ Seeded email templates: APPLIED, SHORTLISTED, REJECTED, ACCEPTED, DATA_RETENTION_WARNING");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
