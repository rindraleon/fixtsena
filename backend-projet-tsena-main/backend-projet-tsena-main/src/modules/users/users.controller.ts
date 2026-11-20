import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, FilterUsersDto } from './dto/user.dto';
import { Roles, CurrentUser, IUserPayload } from '../../common';
import { UserRole } from '../../database/entities';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un utilisateur (admin)' })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return { success: true, message: 'Utilisateur créé avec succès', data: user };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister les utilisateurs (paginé)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'sellerRequested', required: false, type: Boolean })
  async findAll(@Query() filters: FilterUsersDto) {
    const { data, meta } = await this.usersService.findAll(filters);
    return { success: true, message: 'Utilisateurs récupérés', data, meta };
  }

  @Get('me')
  @ApiOperation({ summary: 'Mon profil' })
  async getMe(@CurrentUser() user: IUserPayload) {
    const profile = await this.usersService.findById(user.id);
    return { success: true, message: 'Profil récupéré', data: profile };
  }

  @Post('me/seller-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander l\'ouverture d\'une boutique (rôle vendeur accordé par un admin)' })
  async requestSellerAccount(@CurrentUser() user: IUserPayload) {
    const profile = await this.usersService.requestSellerAccount(user.id);
    return { success: true, message: 'Votre demande a bien été enregistrée. Un administrateur la traitera prochainement.', data: profile };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Récupérer un utilisateur' })
  async findOne(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string) {
    const user = await this.usersService.findById(id);
    return { success: true, message: 'Utilisateur récupéré', data: user };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: IUserPayload,
  ) {
    const user = await this.usersService.update(id, dto, actor.id);
    return { success: true, message: 'Utilisateur mis à jour', data: user };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un utilisateur (soft delete)' })
  async remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
    @CurrentUser() actor: IUserPayload,
  ) {
    await this.usersService.remove(id, actor.id);
    return { success: true, message: 'Utilisateur supprimé avec succès', data: null };
  }
}
