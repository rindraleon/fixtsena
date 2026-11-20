import { ConfigService } from '@nestjs/config';
import { envBool, envInt } from '../../common/utils/env.util';

export type MailDriver = 'smtp' | 'log';

export interface MailConfig {
  readonly driver: MailDriver;
  readonly host: string | null;
  readonly port: number;
  readonly secure: boolean;
  readonly requireTls: boolean;
  readonly rejectUnauthorized: boolean;
  readonly user: string | null;
  readonly password: string | null;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly replyTo: string | null;
  readonly timeoutMs: number;
  readonly pool: boolean;
  readonly verifyOnBoot: boolean;
  readonly fallbackReason: string | null;
}

function clean(raw: string | undefined | null): string {
  const value = (raw ?? '').trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

export function readMailConfig(config: ConfigService): MailConfig {
  const host = clean(config.get<string>('MAIL_HOST')) || null;
  const port = envInt(config.get<string>('MAIL_PORT'), 587);
  const user = clean(config.get<string>('MAIL_USER')) || null;
  const password = clean(config.get<string>('MAIL_PASSWORD')) || null;
  const requestedDriver = clean(config.get<string>('MAIL_DRIVER')).toLowerCase();
  const isLocalHost = host !== null && /^(localhost|127\.0\.0\.1|::1|mailpit|mailhog|smtp4dev)$/i.test(host);

  let driver: MailDriver;
  let fallbackReason: string | null = null;
  if (requestedDriver === 'log') {
    driver = 'log';
    fallbackReason = 'MAIL_DRIVER=log';
  } else if (requestedDriver === 'smtp' || requestedDriver === '') {
    if (host) {
      driver = 'smtp';
    } else {
      driver = 'log';
      fallbackReason = requestedDriver === 'smtp' ? 'MAIL_DRIVER=smtp mais MAIL_HOST est vide' : 'MAIL_HOST non défini';
    }
  } else {
    driver = host ? 'smtp' : 'log';
    fallbackReason = host ? null : `MAIL_DRIVER « ${requestedDriver} » inconnu et MAIL_HOST non défini`;
  }

  return {
    driver,
    host,
    port,
    secure: envBool(config.get<string>('MAIL_SECURE'), port === 465),
    requireTls: envBool(config.get<string>('MAIL_REQUIRE_TLS'), !isLocalHost && port !== 465),
    rejectUnauthorized: envBool(config.get<string>('MAIL_TLS_REJECT_UNAUTHORIZED'), true),
    user,
    password,
    fromEmail: clean(config.get<string>('MAIL_FROM')) || user || 'noreply@tsena.mg',
    fromName: clean(config.get<string>('MAIL_FROM_NAME')) || 'Tsena Marketplace',
    replyTo: clean(config.get<string>('MAIL_REPLY_TO')) || null,
    timeoutMs: Math.max(1_000, envInt(config.get<string>('MAIL_TIMEOUT_MS'), 10_000)),
    pool: envBool(config.get<string>('MAIL_POOL'), false),
    verifyOnBoot: envBool(config.get<string>('MAIL_VERIFY_ON_BOOT'), true),
    fallbackReason,
  };
}

export function maskIdentifier(value: string | null): string | null {
  if (!value) return null;
  const at = value.indexOf('@');
  const local = at > 0 ? value.slice(0, at) : value;
  const domain = at > 0 ? value.slice(at) : '';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}${domain}`;
}
