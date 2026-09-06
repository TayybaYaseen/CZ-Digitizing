import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Controller('api/contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  // Public, unauthenticated form — rate-limited per IP (same defense-in-depth pattern as
  // auth.controller.ts's dev-login/verify-new-device) since there's no CAPTCHA on this form.
  @Public()
  @RateLimit(5, 60)
  @Post()
  @HttpCode(204)
  submit(@Body() dto: CreateContactMessageDto) {
    return this.service.submit(dto);
  }
}
