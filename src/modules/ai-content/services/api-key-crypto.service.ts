import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyCryptoService {
    private readonly logger = new Logger(ApiKeyCryptoService.name);
    private readonly encryptionKey: Buffer;

    constructor(private readonly configService: ConfigService) {
        const secret = this.configService.get('API_KEY_ENCRYPTION_SECRET');
        if (!secret) {
            throw new InternalServerErrorException('API_KEY_ENCRYPTION_SECRET environment variable is required for security.');
        }
        this.encryptionKey = Buffer.from(secret.slice(0, 32), 'utf-8');
    }

    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `v2:${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    decrypt(text: string): string {
        try {
            if (!text.includes(':')) return text;

            const textParts = text.split(':');

            if (textParts[0] === 'v2') {
                const [, ivHex, authTagHex, encryptedHex] = textParts;
                const iv = Buffer.from(ivHex, 'hex');
                const authTag = Buffer.from(authTagHex, 'hex');
                const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
                decipher.setAuthTag(authTag);
                let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            } else if (textParts.length === 2) {
                const iv = Buffer.from(textParts[0], 'hex');
                const encryptedText = Buffer.from(textParts[1], 'hex');
                const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
                let decrypted = decipher.update(encryptedText);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted.toString('utf8');
            }
            return text;
        } catch (e) {
            this.logger.warn(`Failed to decrypt key: ${e.message}`);
            return text;
        }
    }
}
