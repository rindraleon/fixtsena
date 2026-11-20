import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ReportsService } from './reports.service';
import { parseReportPeriod, parseReportType } from './reports.util';
import { FilterAuditLogDto, RejectProductDto } from './dto/admin.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord admin — statistiques globales' })
  async getDashboard() {
    const stats = await this.adminService.getDashboardStats();
    return {
      success: true,
      message: 'Statistiques dashboard récupérées avec succès',
      data: stats,
    };
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspendre un utilisateur' })
  async suspendUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    const user = await this.adminService.suspendUser(id, admin.id);
    return {
      success: true,
      message: 'Utilisateur suspendu avec succès',
      data: user,
    };
  }

  @Post('users/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer un utilisateur' })
  async activateUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    const user = await this.adminService.activateUser(id, admin.id);
    return {
      success: true,
      message: 'Utilisateur activé avec succès',
      data: user,
    };
  }

  @Post('users/:id/approve-seller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver un vendeur' })
  async approveSeller(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    const user = await this.adminService.approveSeller(id, admin.id);
    return {
      success: true,
      message: 'Vendeur approuvé avec succès',
      data: user,
    };
  }

  @Post('products/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver un produit' })
  async approveProduct(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    const product = await this.adminService.approveProduct(id, admin.id);
    return {
      success: true,
      message: 'Produit approuvé avec succès',
      data: product,
    };
  }

  @Post('products/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeter un produit' })
  async rejectProduct(
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @CurrentUser() admin: { id: string },
  ) {
    const product = await this.adminService.rejectProduct(id, dto.reason, admin.id);
    return {
      success: true,
      message: 'Produit rejeté avec succès',
      data: product,
    };
  }

  @Post('products/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspendre un produit publié (modération)' })
  async suspendProduct(
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @CurrentUser() admin: { id: string },
  ) {
    const product = await this.adminService.suspendProduct(id, dto.reason, admin.id);
    return {
      success: true,
      message: 'Produit suspendu avec succès',
      data: product,
    };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Rapport opérationnel et financier sur une période (F-ADM-13) — 30 derniers jours par défaut' })
  @ApiQuery({ name: 'from', required: false, description: 'AAAA-MM-JJ (inclus)' })
  @ApiQuery({ name: 'to', required: false, description: 'AAAA-MM-JJ (inclus, ≤ aujourd’hui)' })
  async getPeriodReport(@Query('from') from?: string, @Query('to') to?: string) {
    const period = parseReportPeriod(from, to);
    const report = await this.reportsService.periodReport(period);
    return {
      success: true,
      message: `Rapport du ${period.fromLabel} au ${period.toLabel}`,
      data: report,
    };
  }

  @Get('reports/export')
  @ApiOperation({ summary: 'Export CSV (commandes, paiements, litiges, commissions) sur une période — action auditée' })
  @ApiQuery({ name: 'type', required: true, enum: ['orders', 'payments', 'disputes', 'commissions'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportReport(
    @Query('type') type: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() admin: { id: string },
    @Res() res: Response,
  ) {
    const reportType = parseReportType(type);
    const period = parseReportPeriod(from, to);
    const { filename, content, rows } = await this.reportsService.exportCsv(reportType, period);
    await this.adminService.createAuditLog(admin.id, 'export_report', 'report', null, { type: reportType, from: period.fromLabel, to: period.toLabel, rows });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Report-Rows', String(rows));
    res.status(HttpStatus.OK).send(content);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Logs d\'audit' })
  async getAuditLogs(@Query() filters: FilterAuditLogDto) {
    const result = await this.adminService.getAuditLogs(filters);
    return {
      success: true,
      message: 'Logs d\'audit récupérés avec succès',
      data: result.items,
      meta: result.meta,
    };
  }
}
