/**
 * Optional convenience: create (or update) a SUPER_ADMIN using Prisma.
 * Credentials come from CLI args or env — nothing is hardcoded.
 *
 *   npm run create:superadmin -- --email admin@example.com --name "Admin" --password 'Strong123!'
 *
 * Or via env: SUPERADMIN_EMAIL, SUPERADMIN_NAME, SUPERADMIN_PASSWORD
 *
 * Prefer the raw-SQL approach in the README if you want to insert the row
 * directly in the database instead.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg('--email') ?? process.env.SUPERADMIN_EMAIL ?? '').toLowerCase();
  const name = arg('--name') ?? process.env.SUPERADMIN_NAME ?? '';
  const password = arg('--password') ?? process.env.SUPERADMIN_PASSWORD ?? '';

  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Make sure a .env file exists with DATABASE_URL,\n' +
        'then run:  npm run create:superadmin -- --email you@x.com --name "Admin" --password "..."',
    );
    process.exit(1);
  }

  if (!email || !name || !password) {
    console.error(
      'Missing input. Provide --email, --name and --password (or the SUPERADMIN_* env vars).',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, fullName: name, role: 'SUPER_ADMIN', isActive: true },
      create: { email, fullName: name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
    });
    console.log(`\nSUPER_ADMIN ready: ${user.email} (id: ${user.id})\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
