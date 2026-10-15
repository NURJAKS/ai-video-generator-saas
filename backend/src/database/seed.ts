import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User, UserRole } from '../users/entities/user.entity';
import { CreditPackage } from '../credits/entities/credit-package.entity';

dotenv.config();

/**
 * Database seed script.
 * Run with: npm run seed
 *
 * Creates:
 *  - 1 admin user (admin@videogen.io / admin123)
 *  - 1 test user  (user@videogen.io  / user123)
 *  - 3 credit packages (Starter, Pro, Enterprise)
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'videogen',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_DATABASE || 'videogen',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true, // OK for seed script
  });

  await dataSource.initialize();
  console.log('Connected to database.');

  const userRepo = dataSource.getRepository(User);
  const packageRepo = dataSource.getRepository(CreditPackage);

  // ── Seed Users ──────────────────────────────────────

  const adminExists = await userRepo.findOne({ where: { email: 'admin@videogen.io' } });
  if (!adminExists) {
    const admin = userRepo.create({
      email: 'admin@videogen.io',
      displayName: 'Admin',
      passwordHash: await bcrypt.hash('admin123', 12),
      role: UserRole.ADMIN,
      creditBalance: 9999,
    });
    await userRepo.save(admin);
    console.log('✅ Admin user created: admin@videogen.io / admin123');
  } else {
    console.log('⏭️  Admin user already exists');
  }

  const userExists = await userRepo.findOne({ where: { email: 'user@videogen.io' } });
  if (!userExists) {
    const user = userRepo.create({
      email: 'user@videogen.io',
      displayName: 'Test User',
      passwordHash: await bcrypt.hash('user123', 12),
      role: UserRole.USER,
      creditBalance: 100,
    });
    await userRepo.save(user);
    console.log('✅ Test user created: user@videogen.io / user123');
  } else {
    console.log('⏭️  Test user already exists');
  }

  // ── Seed Credit Packages ────────────────────────────

  const existingPackages = await packageRepo.count();
  if (existingPackages === 0) {
    const packages = [
      { name: 'Starter', credits: 50, priceUsd: 4.99 },
      { name: 'Pro', credits: 200, priceUsd: 14.99 },
      { name: 'Enterprise', credits: 1000, priceUsd: 59.99 },
    ];

    for (const pkg of packages) {
      const entity = packageRepo.create(pkg);
      await packageRepo.save(entity);
    }
    console.log('✅ Credit packages created: Starter (50), Pro (200), Enterprise (1000)');
  } else {
    console.log('⏭️  Credit packages already exist');
  }

  await dataSource.destroy();
  console.log('\n🌱 Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
