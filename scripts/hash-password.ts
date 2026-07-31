/**
 * Print a bcrypt hash for a password so you can INSERT a SUPER_ADMIN row
 * directly in the database.
 *
 *   npm run hash -- 'YourStrongPassword123!'
 *
 * Then use the printed hash in the SQL shown in README (Super Admin setup).
 */
import bcrypt from 'bcryptjs';

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: npm run hash -- 'your-password'");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log('\nbcrypt hash (copy this into the passwordHash column):\n');
  console.log(hash);
  console.log('');
}

main();
