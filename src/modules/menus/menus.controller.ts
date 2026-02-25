import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { MenusService } from './menus.service';

@Controller('menus')
export class MenusController {
    constructor(private readonly menusService: MenusService) { }

    @Get('structure')
    getStructure(@Query('domain') domain: string) {
        if (!domain) {
            throw new BadRequestException('Domain parameter is required');
        }
        return this.menusService.getMenuStructure(domain);
    }
}
