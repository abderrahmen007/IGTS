/**
 * LOCAL DEVELOPMENT ONLY — creates two test accounts in the local Docker copy
 * of the database so the UI can be checked with real data:
 *
 *   test@igts.com   / password123  → company sub-account of company #207
 *                                     (sees that company's texts)
 *   admin@igts.test / password123  → IGTS administrator
 *
 * Never run this against the production database.
 */
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL is not a local database.');
  process.exit(1);
}

const prisma = new PrismaClient();
const PARENT_COMPANY_ID = Number(process.env.TEST_PARENT_COMPANY_ID || 207);

async function main() {
  const password = await argon2.hash('password123');

  await prisma.company.upsert({
    where: { email: 'test@igts.com' },
    update: { password, multicompte: PARENT_COMPANY_ID, enabled: true, deleted: false },
    create: {
      email: 'test@igts.com',
      password,
      nom: 'Compte de test',
      fonction: 'Responsable QHSE',
      raisonsociale: null,
      roles: JSON.stringify(['ROLE_COMPANY']),
      multicompte: PARENT_COMPANY_ID,
      deleted: false,
      activated: true,
      enabled: true,
      createdAt: new Date(),
    },
  });

  const admin = await prisma.user.findFirst({ where: { email: 'admin@igts.test' } });
  const adminData = {
    username: 'admin.test',
    nomComplet: 'Admin Test',
    email: 'admin@igts.test',
    roles: JSON.stringify(['ROLE_SUPERUSER']),
    valid: true,
    deleted: false,
    admin: true,
    password,
  };
  if (admin) await prisma.user.update({ where: { id: admin.id }, data: adminData });
  else await prisma.user.create({ data: adminData });

  console.log('Test accounts ready (password: password123):');
  console.log(`  company  test@igts.com    (sub-account of company #${PARENT_COMPANY_ID})`);
  console.log('  admin    admin@igts.test');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
