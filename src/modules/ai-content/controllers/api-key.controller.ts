import { Controller, Get, Post, Body, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto } from '../dto/api-key.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { UsersService } from '@/modules/users/users.service';

@Controller('ai-content/keys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApiKeyController {
    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly usersService: UsersService,
    ) { }

    @Get('my')
    async getMyKeys(@Request() req) {
        const user = await this.usersService.findByEmail(req.user.email);
        return this.apiKeyService.getMyKeys(user);
    }

    @Post()
    @Permissions('posts.create') // Cần quyền tạo bài mới đc add key AI
    async upsertKey(@Request() req, @Body() dto: CreateApiKeyDto) {
        const user = await this.usersService.findByEmail(req.user.email);
        return this.apiKeyService.upsertKey(user, dto);
    }

    @Delete(':id')
    async removeKey(@Request() req, @Param('id') id: string) {
        const user = await this.usersService.findByEmail(req.user.email);
        await this.apiKeyService.removeKey(user, id);
        return { success: true };
    }
}
