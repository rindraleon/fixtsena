import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/role.enum';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Administration — tâches planifiées')
@ApiBearerAuth()
@Controller('admin/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Dernier rapport des tâches planifiées' })
  last() {
    return { success: true, message: 'Dernier passage', data: this.maintenance.getLastReport() };
  }

  @Post('run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Exécuter immédiatement les tâches planifiées' })
  async run() {
    const data = await this.maintenance.run('manual');
    return { success: true, message: 'Tâches planifiées exécutées', data };
  }
}
