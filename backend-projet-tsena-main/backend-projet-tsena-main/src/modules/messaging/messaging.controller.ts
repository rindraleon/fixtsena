import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { MessagingService } from './messaging.service';
import { UploadService } from '../upload/upload.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/role.enum';

type AuthUser = { id: string; roles: UserRole[] };

export class AttachmentDto {
  @IsString() url: string;
  @IsString() @MaxLength(200) name: string;
  @IsString() @MaxLength(100) mimeType: string;
  @IsInt() size: number;
}
export class StartConversationDto {
  @IsOptional() @IsUUID('4') sellerId?: string;
  @IsOptional() @IsUUID('4') shopId?: string;
  @IsOptional() @IsUUID('4') productId?: string;
  @IsOptional() @IsUUID('4') orderId?: string;
  @IsOptional() @IsUUID('4') disputeId?: string;
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsString({ message: 'Le message est obligatoire' }) @MinLength(1, { message: 'Le message ne peut pas être vide' }) message: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}
export class SendMessageDto {
  @IsString({ message: 'Le message est obligatoire' }) @MinLength(1, { message: 'Le message ne peut pas être vide' }) message: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}
export class ToggleDto { @IsBoolean() value: boolean; }
export class ReportDto { @IsString() @MinLength(5, { message: 'Précisez le motif (5 caractères minimum)' }) @MaxLength(500) reason: string; }

const ALL_ROLES = [UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN];

function meta(result: { page: number; limit: number; total: number }) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  return { page: result.page, limit: result.limit, total: result.total, totalPages, hasNextPage: result.page < totalPages, hasPreviousPage: result.page > 1 };
}

@ApiTags('messaging')
@ApiBearerAuth()
@Controller()
export class MessagingController {
  constructor(private readonly messagingService: MessagingService, private readonly uploadService: UploadService) {}

  @Get('conversations')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Mes conversations (acheteur et/ou vendeur)' })
  async list(@CurrentUser() user: AuthUser, @Query('role') role?: 'buyer' | 'seller', @Query('archived') archived?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.messagingService.list(user, { role, archived: archived === 'true', page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    return { success: true, message: 'Conversations', data: result.items, meta: meta(result) };
  }

  @Get('conversations/unread-count')
  @Roles(...ALL_ROLES)
  async unread(@CurrentUser() user: AuthUser) {
    return { success: true, message: 'Messages non lus', data: { count: await this.messagingService.unreadCount(user.id) } };
  }

  @Post('conversations')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Démarrer une conversation (ou poursuivre celle du même contexte)' })
  async start(@Body() dto: StartConversationDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Message envoyé', data: await this.messagingService.start(user, dto) };
  }

  @Get('conversations/:id/messages')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Messages d\'une conversation (marque comme lus)' })
  async messages(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.messagingService.messages(user, id, { page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    return { success: true, message: 'Messages', data: { conversation: result.conversation, items: result.items }, meta: meta(result) };
  }

  @Post('conversations/:id/messages')
  @Roles(...ALL_ROLES)
  async send(@Param('id') id: string, @Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Message envoyé', data: await this.messagingService.send(user, id, dto.message, dto.attachments ?? []) };
  }

  @Post('conversations/:id/attachments')
  @Roles(...ALL_ROLES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Téléverser une pièce jointe (image ou PDF) à joindre à un message' })
  async upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    await this.messagingService.messages(user, id, { limit: 1, markRead: false });
    const stored = await this.uploadService.uploadMessageAttachment(file, id);
    return { success: true, message: 'Pièce jointe téléversée', data: { url: stored.url, name: file.originalname, mimeType: file.mimetype, size: file.size } };
  }

  @Post('conversations/:id/archive')
  @Roles(...ALL_ROLES)
  async archive(@Param('id') id: string, @Body() dto: ToggleDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: dto.value ? 'Conversation archivée' : 'Conversation restaurée', data: await this.messagingService.archive(user, id, dto.value) };
  }

  @Post('conversations/:id/block')
  @Roles(...ALL_ROLES)
  async block(@Param('id') id: string, @Body() dto: ToggleDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: dto.value ? 'Interlocuteur bloqué' : 'Interlocuteur débloqué', data: await this.messagingService.block(user, id, dto.value) };
  }

  @Post('messages/:id/report')
  @Roles(...ALL_ROLES)
  async report(@Param('id') id: string, @Body() dto: ReportDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Message signalé : notre équipe va l\'examiner', data: await this.messagingService.report(user, id, dto.reason) };
  }

  @Get('admin/conversations')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Conversations (modération : signalées en priorité)' })
  async adminList(@Query('reported') reported?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.messagingService.adminList({ reported: reported === 'true', page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    return { success: true, message: 'Conversations', data: result.items, meta: meta(result) };
  }

  @Post('admin/messages/:id/hide')
  @Roles(UserRole.ADMIN)
  async hide(@Param('id') id: string, @Body() dto: ToggleDto) {
    return { success: true, message: dto.value ? 'Message masqué' : 'Message rétabli', data: await this.messagingService.adminHide(id, dto.value) };
  }
}
