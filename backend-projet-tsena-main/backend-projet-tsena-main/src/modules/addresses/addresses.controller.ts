import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Adresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Mon carnet d’adresses' })
  async list(@CurrentUser() user: { id: string }) {
    const data = await this.addressesService.list(user.id);
    return { success: true, message: 'Adresses', data };
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter une adresse' })
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateAddressDto) {
    const data = await this.addressesService.create(user.id, dto);
    return { success: true, message: 'Adresse enregistrée', data };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier une adresse' })
  async update(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAddressDto) {
    const data = await this.addressesService.update(user.id, id, dto);
    return { success: true, message: 'Adresse mise à jour', data };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Définir comme adresse par défaut' })
  async setDefault(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    const data = await this.addressesService.setDefault(user.id, id);
    return { success: true, message: 'Adresse par défaut mise à jour', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une adresse' })
  async remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    await this.addressesService.remove(user.id, id);
    return { success: true, message: 'Adresse supprimée', data: null };
  }
}
