import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmailDeliveryStatus, UserRole } from '../../database/entities/role.enum';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'Mes notifications (paginées)' })
  async list(
    @CurrentUser() user: { id: string },
    @Query('unread') unread?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.notificationsService.list(user.id, {
      unreadOnly: unread === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
    return {
      success: true,
      message: 'Notifications',
      data: result.items,
      meta: { page: result.page, limit: result.limit, total: result.total, totalPages, hasNextPage: result.page < totalPages, hasPreviousPage: result.page > 1, unreadCount: result.unreadCount },
    };
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  async unreadCount(@CurrentUser() user: { id: string }) {
    return { success: true, message: 'Non lues', data: { count: await this.notificationsService.unreadCount(user.id) } };
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Tout marquer comme lu' })
  async readAll(@CurrentUser() user: { id: string }) {
    const updated = await this.notificationsService.markAllRead(user.id);
    return { success: true, message: 'Notifications marquées comme lues', data: { updated } };
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  async read(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return { success: true, message: 'Notification lue', data: await this.notificationsService.markRead(user.id, id) };
  }

  @Get('admin/email-logs')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Journal d'envoi des e-mails (admin)" })
  async emailLogs(@Query('status') status?: EmailDeliveryStatus, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.notificationsService.emailLogs({ status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
    return { success: true, message: "Journal d'envoi", data: result.items, meta: { page: result.page, limit: result.limit, total: result.total, totalPages, hasNextPage: result.page < totalPages, hasPreviousPage: result.page > 1 } };
  }
}
