import { Controller, Delete, Get, HttpCode, Param, Post, Put, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/token.types';
import { DesignFilesService } from './design-files.service';

// docs/specs/2026-08-28-05-private-file-management.md §3 (aspect A-007, AC-1/AC-2/AC-7/AC-12).
// memoryStorage: files are hashed and validated (size/format) before ever touching disk — a
// stream-to-disk approach would need to write first and delete on rejection, which is more moving
// parts for no benefit at the 50MB/250MB limits this spec sets.
@ApiTags('designs/files')
@ApiBearerAuth()
@Controller('api/designs/:id/files')
@Roles('admin', 'freelancer', 'moderator')
@RequiresPermission('designs', 'crud')
export class DesignFilesController {
  constructor(private readonly service: DesignFilesService) {}

  @Get()
  @RequiresPermission('designs', 'read_only')
  list(@Param('id') id: string) {
    return this.service.listForDesign(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage() }))
  @HttpCode(201)
  upload(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() admin: AccessTokenPayload) {
    return this.service.upload(id, files, admin);
  }

  @Put(':fileId/replace')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  replace(@Param('id') id: string, @Param('fileId') fileId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() admin: AccessTokenPayload) {
    return this.service.replace(id, fileId, file, admin);
  }

  @Delete(':fileId')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Param('fileId') fileId: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.service.remove(id, fileId, admin);
  }
}
