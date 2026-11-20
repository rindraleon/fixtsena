import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/contact.dto';

interface OptionalUser {
  id?: string;
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envoyer un message via le formulaire de contact public' })
  async submit(@Body() dto: CreateContactMessageDto, @CurrentUser() user?: OptionalUser) {
    const result = await this.contactService.submit(dto, user?.id ?? null);
    return {
      success: true,
      message: result.delivered
        ? 'Votre message a été transmis à l’équipe Tsena'
        : 'Votre message n’a pas pu être transmis',
      data: result,
    };
  }
}
