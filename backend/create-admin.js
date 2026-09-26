/**
 * Creates (or updates) an IGTS administrator account.
 *
 *   node --env-file=.env create-admin.js
 *
 * Asks for the e-mail, full name and password in the terminal (the password is
 * not displayed and never stored in the shell history). The password is hashed
 * with argon2id, like the legacy Symfony platform.
 *
 * Runs against the local database only. For another database, set
 * ALLOW_REMOTE_DB=1 explicitly.
 */
const readline = require('readline');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL || '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl) && process.env.ALLOW_REMOTE_DB !== '1') {
  console.error('Refus : DATABASE_URL ne pointe pas vers une base locale (ALLOW_REMOTE_DB=1 pour forcer).');
  process.exit(1);
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Show the prompt but not what is typed
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = (await ask('E-mail de l’administrateur : ')).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Adresse e-mail invalide');

  const nom = await ask('Nom complet : ');
  if (!nom) throw new Error('Nom requis');

  const password = await ask('Mot de passe (12 caractères min.) : ', { hidden: true });
  if (password.length < 12) throw new Error('Mot de passe trop court (12 caractères minimum)');
  const confirm = await ask('Confirmez le mot de passe : ', { hidden: true });
  if (confirm !== password) throw new Error('Les mots de passe ne correspondent pas');

  const prisma = new PrismaClient();
  try {
    const data = {
      email,
      username: email.split('@')[0],
      nomComplet: nom.slice(0, 50),
      roles: JSON.stringify(['ROLE_SUPERUSER']),
      valid: true,
      deleted: false,
      admin: true,
      password: await argon2.hash(password, { type: argon2.argon2id }),
    };
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data });
      console.log(`Compte administrateur mis à jour : ${email}`);
    } else {
      await prisma.user.create({ data });
      console.log(`Compte administrateur créé : ${email}`);
    }
    console.log('Connexion : onglet « Administration IGTS » sur la page de connexion.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`Erreur : ${e.message}`);
  process.exit(1);
});
