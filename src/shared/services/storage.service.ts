import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
// FIX: Đổi cách import để tránh lỗi "not callable"
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private publicDomain: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicDomain = this.configService.getOrThrow<string>('R2_PUBLIC_DOMAIN');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.getOrThrow<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async processAndUpload(
    buffer: Buffer,
    folder: string = 'media',
    filename?: string
  ): Promise<string> {
    try {
      // 1. Resize & Nén WebP (Giảm dung lượng 50-70%)
      const processedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      // 2. Tạo tên file
      const finalName = filename ? `${filename}.webp` : `${uuidv4()}.webp`;
      const key = `${folder}/${finalName}`;

      // 3. Upload lên R2
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: 'image/webp',
      }));

      // 4. Trả về Public URL
      return `${this.publicDomain}/${key}`;
    } catch (error) {
      this.logger.error(`Storage Upload Error: ${error.message}`);
      throw error;
    }
  }
}