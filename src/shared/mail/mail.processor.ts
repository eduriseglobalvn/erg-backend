import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

@Processor('mail_queue')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[MAIL] Đang xử lý job: ${job.name} cho ${job.data.email}`);

    try {
      switch (job.name) {
        case 'send_confirmation':
          await this.sendConfirmationEmail(job.data);
          break;
        default:
          this.logger.warn(`Không tìm thấy handler cho job: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`[MAIL] Gửi thất bại:`, error);
      throw error; // Ném lỗi để BullMQ biết và retry
    }
  }

  private async sendConfirmationEmail(data: any) {
    await this.mailerService.sendMail({
      to: data.email,
      subject: '🔐 ERG Education - Mã xác thực tài khoản',
      template: './auth-verify-pin', // Trùng tên file .hbs (không cần đuôi)
      context: {
        name: data.name,
        pin: data.pin,
      },
    });
    this.logger.log(`[MAIL] -> Đã gửi thành công tới ${data.email}`);
  }
}