import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Standalone DataSource for TypeORM CLI (migrations).
 * NOT used at runtime — NestJS uses TypeOrmModule.forRootAsync().
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'videogen',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_DATABASE || 'videogen',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
