import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './database.config';

export const AppDataSource = new DataSource({
  ...(databaseConfig(new ConfigService()) as DataSourceOptions),
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'migrations',
});
