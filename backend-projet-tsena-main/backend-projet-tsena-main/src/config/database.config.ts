import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { envInt, envBool } from '../common/utils/env.util';

export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  const nodeEnv = config.get<string>('NODE_ENV');
  const databaseUrl = (config.get<string>('DATABASE_URL') ?? '').trim();
  const isRemoteUrl = databaseUrl !== '' && !/@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);

  const connection = databaseUrl
    ? { url: databaseUrl }
    : {
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: envInt(config.get<string>('DATABASE_PORT'), 5432),
        username: config.get<string>('DATABASE_USER', 'tsena'),
        password: config.get<string>('DATABASE_PASSWORD', 'tsena_secret'),
        database: config.get<string>('DATABASE_NAME', 'tsena_db'),
      };

  const ssl = envBool(config.get<string>('DATABASE_SSL'), isRemoteUrl);

  return {
    type: 'postgres',
    ...connection,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    synchronize: envBool(config.get<string>('DATABASE_SYNCHRONIZE'), false),
    logging: resolveLogging(config.get<string>('DATABASE_LOGGING'), nodeEnv),
    entities: [join(__dirname, '../database/entities/*.entity{.ts,.js}')],
    migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
    migrationsRun: true,
  };
}

export function resolveLogging(raw: string | undefined, nodeEnv: string | undefined): TypeOrmModuleOptions['logging'] {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') return nodeEnv === 'test' ? false : ['error', 'warn', 'schema'];
  return envBool(raw, false);
}
