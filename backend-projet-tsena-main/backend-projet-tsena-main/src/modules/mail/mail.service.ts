import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type SMTPPool from 'nodemailer/lib/smtp-pool';
import { MailConfig, maskIdentifier, readMailConfig } from './mail.config';

export interface MailSendResult {
  readonly sent: boolean;
  readonly messageId?: string;
  readonly error?: string;
  readonly attempts: number;
  readonly durationMs: number;
}

export interface MailStatus {
  readonly driver: 'smtp' | 'log';
  readonly host: string | null;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string | null;
  readonly from: string;
  readonly replyTo: string | null;
  readonly ready: boolean | null;
  readonly lastError: string | null;
  readonly lastSentAt: string | null;
  readonly sentCount: number;
  readonly failedCount: number;
  readonly fallbackReason: string | null;
}

const TRANSIENT_ERROR = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ESOCKET|Timeout|Greeting never received|4\d\d/;

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly config: MailConfig;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly appUrl: string;
  private readonly appName: string;
  private transporter: Transporter | null = null;
  private ready: boolean | null = null;
  private lastError: string | null = null;
  private lastSentAt: Date | null = null;
  private sentCount = 0;
  private failedCount = 0;

  constructor(private readonly configService: ConfigService) {
    this.config = readMailConfig(configService);
    this.fromEmail = this.config.fromEmail;
    this.fromName = this.config.fromName;
    this.appUrl = (this.configService.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    this.appName = this.configService.get<string>('APP_NAME') || 'Tsena';
    if (this.config.driver === 'smtp') {
      this.transporter = this.createTransporter(this.config);
    }
  }

  onModuleInit(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (this.config.driver === 'log') {
      const message = `E-mails en mode « log » (${this.config.fallbackReason}) : aucun message ne sera envoyé.`;
      if (nodeEnv === 'production') this.logger.warn(`${message} Définissez MAIL_HOST / MAIL_USER / MAIL_PASSWORD.`);
      else this.logger.log(message);
      return;
    }
    this.logger.log(
      `Transport SMTP : ${this.config.host}:${this.config.port} (${this.config.secure ? 'TLS' : 'STARTTLS'}, ` +
        `utilisateur ${maskIdentifier(this.config.user) ?? 'aucun'}, expéditeur ${this.fromEmail})`,
    );
    if (this.config.verifyOnBoot) {
      void this.verify();
    }
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      this.ready = true;
      this.lastError = null;
      this.logger.log(`SMTP prêt (${this.config.host}:${this.config.port}).`);
      return true;
    } catch (error) {
      this.ready = false;
      this.lastError = this.describeError(error);
      this.logger.error(`SMTP injoignable ou identifiants refusés : ${this.lastError}`);
      return false;
    }
  }

  getStatus(): MailStatus {
    return {
      driver: this.config.driver,
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      user: maskIdentifier(this.config.user),
      from: `${this.fromName} <${this.fromEmail}>`,
      replyTo: this.config.replyTo,
      ready: this.config.driver === 'log' ? null : this.ready,
      lastError: this.lastError,
      lastSentAt: this.lastSentAt ? this.lastSentAt.toISOString() : null,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      fallbackReason: this.config.fallbackReason,
    };
  }

  async sendTestEmail(to: string, requestedBy?: string): Promise<MailSendResult> {
    const html = this.wrapTemplate({
      title: 'Test de configuration e-mail',
      preheader: `Le serveur SMTP de ${this.appName} est correctement configuré.`,
      greeting: 'Bonjour,',
      body: `
        <p>Ce message confirme que l'envoi d'e-mails depuis <strong>${this.appName}</strong> fonctionne.</p>
        <div class="info-box">
          <p><strong>Serveur :</strong> ${this.config.host ?? 'mode log'}:${this.config.port}</p>
          <p><strong>Expéditeur :</strong> ${this.fromName} &lt;${this.fromEmail}&gt;</p>
          ${requestedBy ? `<p><strong>Demandé par :</strong> ${requestedBy}</p>` : ''}
          <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}</p>
        </div>
        <p class="muted">Si vous n'êtes pas à l'origine de ce test, vous pouvez ignorer ce message.</p>
      `,
    });
    return this.deliver(to, `[${this.appName}] Test de configuration e-mail`, html);
  }

  private async send(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
    return (await this.deliver(to, subject, html, replyTo)).sent;
  }

  private async deliver(to: string, subject: string, html: string, replyTo?: string): Promise<MailSendResult> {
    const startedAt = Date.now();
    const text = this.toPlainText(html);

    if (!this.transporter) {
      this.logPreview(to, subject, text);
      this.sentCount += 1;
      this.lastSentAt = new Date();
      return { sent: true, attempts: 0, durationMs: Date.now() - startedAt };
    }

    const message: nodemailer.SendMailOptions = {
      from: { name: this.fromName, address: this.fromEmail },
      to,
      subject,
      html,
      text,
      replyTo: replyTo ?? this.config.replyTo ?? undefined,
      headers: { 'X-Mailer': `${this.appName} Marketplace` },
    };

    let lastError: unknown;
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const info = (await this.transporter.sendMail(message)) as SMTPTransport.SentMessageInfo;
        this.ready = true;
        this.lastError = null;
        this.lastSentAt = new Date();
        this.sentCount += 1;
        const rejected = Array.isArray(info.rejected) ? info.rejected.length : 0;
        this.logger.log(`E-mail envoyé à ${to} — « ${subject} » (id ${info.messageId}${rejected ? `, ${rejected} refusé(s)` : ''})`);
        return { sent: true, messageId: info.messageId, attempts: attempt, durationMs: Date.now() - startedAt };
      } catch (error) {
        lastError = error;
        const description = this.describeError(error);
        if (attempt < maxAttempts && TRANSIENT_ERROR.test(description)) {
          this.logger.warn(`Envoi à ${to} en échec (tentative ${attempt}/${maxAttempts}) : ${description} — nouvelle tentative…`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        break;
      }
    }

    this.failedCount += 1;
    this.lastError = this.describeError(lastError);
    this.ready = false;
    this.logger.error(`E-mail NON envoyé à ${to} — « ${subject} » : ${this.lastError}`);
    return { sent: false, error: this.lastError, attempts: maxAttempts, durationMs: Date.now() - startedAt };
  }

  private createTransporter(config: MailConfig): Transporter {
    const options: SMTPTransport.Options = {
      host: config.host ?? undefined,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTls,
      auth: config.user ? { user: config.user, pass: config.password ?? '' } : undefined,
      tls: { rejectUnauthorized: config.rejectUnauthorized },
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      socketTimeout: config.timeoutMs * 2,
    };
    if (config.pool) {
      return nodemailer.createTransport({ ...options, pool: true } as SMTPPool.Options);
    }
    return nodemailer.createTransport(options);
  }

  private logPreview(to: string, subject: string, text: string): void {
    this.logger.log(
      `\n${'='.repeat(60)}\n📧 E-MAIL (mode log — non envoyé)\nDe: ${this.fromName} <${this.fromEmail}>\nÀ: ${to}\nSujet: ${subject}\n---\n` +
        `${text.substring(0, 400)}${text.length > 400 ? '…' : ''}\n${'='.repeat(60)}`,
    );
  }

  private toPlainText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<span[^>]*display:none[^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
        const cleanLabel = label.replace(/<[^>]*>/g, '').trim();
        return cleanLabel && cleanLabel !== href ? `${cleanLabel} (${href})` : href;
      })
      .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();
  }

  private describeError(error: unknown): string {
    if (!error) return 'erreur inconnue';
    const err = error as { code?: string; responseCode?: number; response?: string; message?: string; command?: string };
    const parts = [err.code, err.responseCode ? `SMTP ${err.responseCode}` : null, err.message || err.response].filter(Boolean);
    return parts.join(' — ') || String(error);
  }

  async sendTransactional(opts: {
    to: string;
    subject: string;
    name?: string;
    heading: string;
    message: string;
    orderNumber?: string | null;
    status?: string | null;
    nextAction?: string | null;
    actionLabel?: string;
    actionPath?: string | null;
    helpEmail?: string;
  }): Promise<boolean> {
    const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
    const actionUrl = opts.actionPath ? `${this.appUrl}${opts.actionPath}` : null;
    const helpEmail = opts.helpEmail ?? 'support@tsena.mg';
    const details = [
      opts.orderNumber ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;"><strong>Référence :</strong> ${esc(opts.orderNumber)}</p>` : '',
      opts.status ? `<p style="margin:0 0 6px;color:#374151;font-size:14px;"><strong>Statut :</strong> ${esc(opts.status)}</p>` : '',
      opts.nextAction ? `<p style="margin:0;color:#374151;font-size:14px;"><strong>Prochaine étape :</strong> ${esc(opts.nextAction)}</p>` : '',
    ].join('');
    const html = this.wrapTemplate({
      title: opts.subject,
      preheader: opts.message.slice(0, 120),
      greeting: `Bonjour ${esc(opts.name || '')},`.replace(' ,', ','),
      body: `
        <h2 style="margin:0 0 16px;color:#0d3b2e;font-size:20px;">${esc(opts.heading)}</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">${esc(opts.message)}</p>
        ${details ? `<div style="margin:0 0 24px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">${details}</div>` : ''}
        ${actionUrl ? `<p style="margin:0 0 24px;text-align:center;"><a class="button" href="${actionUrl}" style="display:inline-block;padding:14px 28px;background-color:#0d3b2e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${esc(opts.actionLabel || 'Ouvrir dans Tsena')}</a></p>` : ''}
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Besoin d'aide ? Écrivez-nous à <a href="mailto:${helpEmail}" style="color:#0d3b2e;">${helpEmail}</a>.</p>
        <p style="margin:0;color:#9ca3af;font-size:12px;">Gérer mes préférences de notification : <a href="${this.appUrl}/dashboard/client/profil" style="color:#0d3b2e;">${this.appUrl}/dashboard/client/profil</a></p>
      `,
    });
    return this.send(opts.to, opts.subject, html);
  }

  async sendContactMessage(opts: {
    to: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    userId?: string | null;
  }): Promise<boolean> {
    const esc = (value: string) =>
      value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

    const html = this.wrapTemplate({
      title: `Message de contact : ${opts.subject}`,
      preheader: opts.message.slice(0, 120),
      greeting: 'Bonjour,',
      body: `
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Un nouveau message a été envoyé depuis le formulaire de contact de <strong>${this.appName}</strong>.</p>
        <div style="margin:0 0 24px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <p style="margin:0 0 6px;color:#374151;font-size:14px;"><strong>Nom :</strong> ${esc(opts.name)}</p>
          <p style="margin:0 0 6px;color:#374151;font-size:14px;"><strong>E-mail :</strong> ${esc(opts.email)}</p>
          <p style="margin:0 0 6px;color:#374151;font-size:14px;"><strong>Objet :</strong> ${esc(opts.subject)}</p>
          <p style="margin:0;color:#374151;font-size:14px;"><strong>Date :</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}</p>
          ${opts.userId ? `<p style="margin:6px 0 0;color:#374151;font-size:14px;"><strong>Compte :</strong> ${esc(opts.userId)}</p>` : ''}
        </div>
        <h2 style="margin:0 0 12px;color:#0d3b2e;font-size:18px;">Message</h2>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(opts.message)}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Répondez directement à cet e-mail pour contacter l'expéditeur.</p>
      `,
    });

    return this.send(opts.to, `[${this.appName}] Contact — ${opts.subject}`, html, opts.email);
  }

  async sendVerificationEmail(to: string, token: string, name?: string): Promise<boolean> {
    const verifyUrl = `${this.appUrl}/verification-email?token=${encodeURIComponent(token)}`;

    const html = this.wrapTemplate({
      title: 'Vérifiez votre adresse e-mail',
      preheader: `Bienvenue sur ${this.appName} ! Vérifiez votre adresse e-mail pour activer votre compte.`,
      greeting: name ? `Bonjour ${name},` : 'Bonjour,',
      body: `
        <p>Merci d'avoir créé un compte sur <strong>${this.appName}</strong> !</p>
        <p>Pour activer votre compte et accéder à toutes les fonctionnalités, veuillez vérifier votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>
        <div class="cta">
          <a href="${verifyUrl}" class="button">Vérifier mon adresse e-mail</a>
        </div>
        <p class="muted">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
        <p class="link">${verifyUrl}</p>
        <p class="muted">Ce lien expirera dans 24 heures. Si vous n'avez pas créé de compte sur ${this.appName}, vous pouvez ignorer cet e-mail.</p>
      `,
    });

    return this.send(to, `[${this.appName}] Vérifiez votre adresse e-mail`, html);
  }

  async sendPasswordResetEmail(to: string, token: string, name?: string): Promise<boolean> {
    const resetUrl = `${this.appUrl}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;

    const html = this.wrapTemplate({
      title: 'Réinitialiser votre mot de passe',
      preheader: `Demande de réinitialisation de mot de passe sur ${this.appName}.`,
      greeting: name ? `Bonjour ${name},` : 'Bonjour,',
      body: `
        <p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>${this.appName}</strong>.</p>
        <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
        <div class="cta">
          <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
        </div>
        <p class="muted">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
        <p class="link">${resetUrl}</p>
        <p class="muted">Ce lien expirera dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité.</p>
      `,
    });

    return this.send(to, `[${this.appName}] Réinitialisation de votre mot de passe`, html);
  }

  async sendPasswordChangedEmail(to: string, name?: string): Promise<boolean> {
    const html = this.wrapTemplate({
      title: 'Mot de passe modifié',
      preheader: `Votre mot de passe ${this.appName} a été modifié avec succès.`,
      greeting: name ? `Bonjour ${name},` : 'Bonjour,',
      body: `
        <p>Votre mot de passe sur <strong>${this.appName}</strong> a été modifié avec succès.</p>
        <p>Si vous êtes à l'origine de cette modification, aucune action n'est requise.</p>
        <div class="alert">
          <p><strong>Vous n'avez pas demandé ce changement ?</strong></p>
          <p>Votre compte est peut-être compromis. Contactez-nous immédiatement et changez votre mot de passe.</p>
        </div>
        <p class="muted">Pour toute question, contactez notre support à support@tsena.mg</p>
      `,
    });

    return this.send(to, `[${this.appName}] Votre mot de passe a été modifié`, html);
  }

  async sendSecurityAlert(to: string, action: string, details?: string, name?: string): Promise<boolean> {
    const html = this.wrapTemplate({
      title: 'Alerte de sécurité',
      preheader: `Activité suspecte détectée sur votre compte ${this.appName}.`,
      greeting: name ? `Bonjour ${name},` : 'Bonjour,',
      body: `
        <p>Une activité de sécurité a été détectée sur votre compte <strong>${this.appName}</strong> :</p>
        <div class="info-box">
          <p><strong>Action :</strong> ${action}</p>
          ${details ? `<p><strong>Détails :</strong> ${details}</p>` : ''}
          <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}</p>
        </div>
        <p>Si cette activité provient de vous, aucune action n'est nécessaire.</p>
        <div class="alert">
          <p><strong>Ce n'était pas vous ?</strong></p>
          <p>Changez immédiatement votre mot de passe et activez la vérification en deux étapes si disponible.</p>
        </div>
      `,
    });

    return this.send(to, `[${this.appName}] Alerte de sécurité`, html);
  }

  private wrapTemplate(opts: {
    title: string;
    preheader: string;
    greeting: string;
    body: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none!important;visibility:hidden;height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:30px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:30px 40px;background-color:#0d3b2e;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="margin:0;color:#f0c040;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Tsena</h1>
              <p style="margin:5px 0 0;color:rgba(255,255,255,0.6);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Marketplace</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;background-color:#ffffff;">
              <p style="margin:0 0 20px;color:#1a1a1a;font-size:16px;line-height:1.5;">${opts.greeting}</p>
              ${opts.body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;text-align:center;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} Tsena Marketplace. Tous droits réservés.</p>
              <p style="margin:0;color:#9ca3af;font-size:11px;">Antananarivo, Madagascar</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <style>
    .button{display:inline-block;padding:14px 28px;background-color:#0d3b2e;color:#ffffff!important;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;}
    .button:hover{background-color:#1a5c47;}
    .cta{text-align:center;margin:24px 0;}
    .muted{color:#6b7280!important;font-size:13px!important;line-height:1.5;}
    .link{background-color:#f3f4f6;padding:10px 14px;border-radius:6px;font-size:12px;word-break:break-all;color:#374151;font-family:monospace;}
    .alert{background-color:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;margin:20px 0;}
    .alert p{margin:4px 0;font-size:14px;}
    .info-box{background-color:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:4px;margin:16px 0;}
    .info-box p{margin:4px 0;font-size:14px;}
  </style>
</body>
</html>`;
  }
}
