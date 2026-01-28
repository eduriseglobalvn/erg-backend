import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { ResponseMessage } from '@/core/decorators/response-message.decorator';
import { ApiMessage } from '@/shared/enums/message.enum';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('current')
  @ResponseMessage(ApiMessage.GET_CURRENT_SESSION_SUCCESS)
  async getCurrentSession(@Req() req: any) {
    // req.user được tạo ra từ JwtStrategy
    // Cấu trúc mong đợi: { sub: 'userId...', email: '...', sessionId: 'sessionId...', ... }
    const userId = req.user.sub;
    const sessionId = req.user.sessionId;

    // Truyền cả userId và sessionId xuống Service
    return this.sessionsService.getCurrentSessionContext(userId, sessionId);
  }
}