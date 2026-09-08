import { PrismaClient } from '@prisma/client';
import { seedDemoPortal } from '../src/lib/demo/seed-data';

const db = new PrismaClient();

async function main() {
  const result = await seedDemoPortal(db);
  if (result.created) {
    console.log(`✓ demo portal seeded (${result.portalId})`);
  } else {
    console.log('• demo portal already present — nothing to do');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
