import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('settings/public')
  @ApiOperation({ summary: 'Paramètres publics (prix des abonnements, offres de promotion, seuils des niveaux…)' })
  getPublic() {
    return { success: true, message: 'Paramètres publics', data: this.settingsService.getPublic() };
  }

  @Get('admin/settings')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tous les paramètres de plateforme (admin)' })
  getAll() {
    return { success: true, message: 'Paramètres de plateforme', data: this.settingsService.getAll() };
  }

  @Put('admin/settings')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour des paramètres (admin)' })
  async update(@Body() body: Record<string, unknown>, @CurrentUser() user: { id: string }) {
    const values = await this.settingsService.update(body, user.id);
    return { success: true, message: 'Paramètres mis à jour', data: values };
  }

  @Delete('admin/settings/:key')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Réinitialiser un paramètre à sa valeur par défaut (admin)' })
  async reset(@Param('key') key: string) {
    await this.settingsService.reset(key);
    return { success: true, message: 'Paramètre réinitialisé', data: this.settingsService.getAll().values };
  }
}
