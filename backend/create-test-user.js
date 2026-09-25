const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestAccount() {
  try {
    const password = 'password123';
    const hashedPassword = await argon2.hash(password);

    const testCompany = await prisma.company.upsert({
      where: { email: 'test@igts.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'test@igts.com',
        password: hashedPassword,
        nom: 'Entreprise Test IGTS',
        raisonsociale: 'Test SARL',
        roles: JSON.stringify(['ROLE_COMPANY']),
        deleted: false,
        activated: true,
        enabled: true,
        createdAt: new Date(),
        multicompte: 0
      },
    });

    console.log('✅ Test account ready!');
    console.log('--------------------------------');
    console.log('Email: test@igts.com');
    console.log('Password: password123');
    console.log('--------------------------------');
  } catch (error) {
    console.error('Failed to create test account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccount();
