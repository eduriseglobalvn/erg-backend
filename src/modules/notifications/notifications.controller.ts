import { Controller, Get, Post, Patch, Delete, Param, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    async getNotifications(
        @Req() req: any,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        return this.notificationsService.findByUser(
            req.user.id,
            limit ? parseInt(limit.toString()) : 20,
            offset ? parseInt(offset.toString()) : 0,
        );
    }

    @Get('unread-count')
    async getUnreadCount(@Req() req: any) {
        const count = await this.notificationsService.countUnread(req.user.id);
        return { count };
    }

    @Patch(':id/read')
    async markAsRead(@Param('id') id: string, @Req() req: any) {
        return this.notificationsService.markAsRead(id, req.user.id);
    }

    @Patch('read-all')
    async markAllAsRead(@Req() req: any) {
        const count = await this.notificationsService.markAllAsRead(req.user.id);
        return { updated: count };
    }

    @Delete(':id')
    async deleteNotification(@Param('id') id: string, @Req() req: any) {
        const success = await this.notificationsService.delete(id, req.user.id);
        return { success };
    }
}
