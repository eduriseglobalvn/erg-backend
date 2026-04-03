import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // F7.2: Serve IndexNow verification key file
  @Get(':key.txt')
  serveIndexNowKey(@Param('key') key: string): string {
    const expectedKey = this.configService.get<string>('INDEXNOW_KEY');
    if (expectedKey && key === expectedKey) {
      return expectedKey;
    }
    throw new NotFoundException();
  }
}
