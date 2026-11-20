import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { MailService } from '../mail/mail.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    let database: 'up' | 'down' = 'down';
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        database = 'up';
      }
    } catch {
      database = 'down';
    }
    const mail = this.mailService.getStatus();
    const payload = {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      mail: mail.driver === 'log' ? 'log' : mail.ready === false ? 'error' : mail.ready ? 'up' : 'unknown',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? null,
    };
    if (database !== 'up') throw new ServiceUnavailableException('Base de données indisponible');
    return payload;
  }
}
