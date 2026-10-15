import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CreditsModule } from './credits/credits.module';
import { GenerationModule } from './generation/generation.module';
import { AiModule } from './ai/ai.module';
import { MediaModule } from './media/media.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // ── Environment Config ──────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('7d'),
        OPENAI_API_KEY: Joi.string().required(),
        ELEVENLABS_API_KEY: Joi.string().required(),
        FAL_API_KEY: Joi.string().required(),
        UPLOAD_DIR: Joi.string().default('./uploads'),
      }),
    }),

    // ── Database ────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'development', // migrations in prod
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    // ── Redis + BullMQ ──────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        },
      }),
    }),

    // ── Rate Limiting ───────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: 60000,  // 1 minute window
        limit: 60,   // max 60 requests per minute
      },
    ]),

    // ── Feature Modules ─────────────────────────────────
    AuthModule,
    UsersModule,
    CreditsModule,
    GenerationModule,
    AiModule,
    MediaModule,
    WebsocketModule,
    AdminModule,
  ],
})
export class AppModule {}
