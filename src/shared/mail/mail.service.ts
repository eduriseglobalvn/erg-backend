import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MailService {
  constructor(@InjectQueue('mail_queue') private mailQueue: Queue) {}

  /**
   * Gửi mã PIN xác thực (Register / Resend PIN)
   */
  async sendUserConfirmation(
    user: { email: string; name: string },
    pin: string,
  ) {
    await this.mailQueue.add(
      'send_confirmation', // Tên Job
      {
        email: user.email,
        name: user.name,
        pin: pin,
      },
      {
        attempts: 3, // Thử lại 3 lần nếu Mắt Bão lỗi
        backoff: 5000, // Đợi 5s giữa các lần thử
        removeOnComplete: true, // Xóa job khi xong
      },
    );
    return true;
  }
}