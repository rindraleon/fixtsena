import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, IUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/role.enum';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/mail.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'État du transport e-mail (SMTP)' })
  status() {
    return this.mailService.getStatus();
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérifier la connexion SMTP (sans envoi)' })
  async verify() {
    const ok = await this.mailService.verify();
    return { ok, ...this.mailService.getStatus() };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Envoyer un e-mail de test" })
  async test(@Body() dto: SendTestMailDto, @CurrentUser() user: IUserPayload) {
    const to = dto.to || user.email;
    const result = await this.mailService.sendTestEmail(to, user.email);
    return { to, ...result, status: this.mailService.getStatus() };
  }
}
