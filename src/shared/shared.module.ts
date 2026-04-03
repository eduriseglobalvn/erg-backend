// src/shared/shared.module.ts
import { Module, Global } from '@nestjs/common';
import { StorageService } from './services/storage.service'; // Đường dẫn tới file service của bạn
import { SseService } from './sse/sse.service';

@Global() // (Tùy chọn) Nếu để Global thì import 1 lần dùng được toàn app
@Module({
  providers: [StorageService, SseService],
  exports: [StorageService, SseService],
})
export class SharedModule { }