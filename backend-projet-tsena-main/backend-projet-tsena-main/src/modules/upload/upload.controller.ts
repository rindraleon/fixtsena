import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { ProductsService } from '../products/products.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/role.enum';

type AuthUser = { id: string; roles: UserRole[] };

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly productsService: ProductsService,
  ) {}

  @Post('product/:productId/image')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload une image produit (stockage + enregistrement catalogue)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProductImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { isPrimary?: string | boolean; alt?: string },
    @CurrentUser() user: AuthUser,
  ) {
    await this.productsService.assertCanManage(productId, user.id, user.roles);
    const stored = await this.uploadService.uploadProductImage(file, productId);
    const isPrimary = body?.isPrimary === true || body?.isPrimary === 'true';
    const image = await this.productsService.addImage(
      productId,
      stored.url,
      body?.alt,
      isPrimary,
      user.id,
      user.roles,
    );
    return {
      success: true,
      message: 'Image uploadée avec succès',
      data: { ...image, key: stored.key },
    };
  }

  @Post('product/:productId/images')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload plusieurs images produit (max 10)' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadProductImages(
    @Param('productId') productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ) {
    await this.productsService.assertCanManage(productId, user.id, user.roles);
    const stored = await this.uploadService.uploadMultiple(files, 'products', productId);
    const images: Array<Record<string, unknown>> = [];
    for (const item of stored) {
      const image = await this.productsService.addImage(
        productId,
        item.url,
        undefined,
        undefined,
        user.id,
        user.roles,
      );
      images.push({ ...image, key: item.key });
    }
    return {
      success: true,
      message: `${images.length} image(s) uploadée(s) avec succès`,
      data: images,
    };
  }

  @Post('category/:categoryId/image')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload une image de catégorie (admin)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCategoryImage(
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadCategoryImage(file, categoryId);
    return {
      success: true,
      message: 'Image catégorie uploadée avec succès',
      data: result,
    };
  }

  @Post('avatar')
  @Roles(UserRole.CLIENT, UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload un avatar utilisateur' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.uploadService.uploadAvatar(file, user.id);
    return {
      success: true,
      message: 'Avatar uploadé avec succès',
      data: result,
    };
  }

  @Post('dispute/:disputeId/evidence')
  @Roles(UserRole.CLIENT, UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload une preuve de litige' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDisputeEvidence(
    @Param('disputeId') disputeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadDisputeEvidence(file, disputeId);
    return {
      success: true,
      message: 'Preuve uploadée avec succès',
      data: result,
    };
  }

  @Delete(':key(*)')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un fichier par clé (admin)' })
  async removeFile(@Param('key') key: string) {
    await this.uploadService.removeFile(key);
    return {
      success: true,
      message: 'Fichier supprimé avec succès',
    };
  }
}
