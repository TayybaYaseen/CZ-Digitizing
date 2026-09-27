import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { ContactService } from './contact.service';

// Admin view of public contact form submissions — the target of contact_message notifications.
@ApiTags('admin/contact-messages')
@ApiBearerAuth()
@Controller('api/admin/contact-messages')
@Roles('admin')
export class ContactAdminController {
  constructor(private readonly service: ContactService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    const { items, total } = await this.service.list(query.page, query.pageSize);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }
}
