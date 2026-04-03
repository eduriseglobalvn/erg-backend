import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { SearchEngineSubmissionLog, SubmissionStatus } from '../entities/search-engine-submission-log.entity';
import axios from 'axios';
import { google } from 'googleapis';

export interface SubmissionResult {
    url: string;
    engine: string;
    status: SubmissionStatus;
    message?: string;
}

@Injectable()
export class SearchEngineSubmissionService {
    private readonly logger = new Logger(SearchEngineSubmissionService.name);
    private indexingApiReady = false;
    private jwtClient: any;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(SearchEngineSubmissionLog, 'mongo-connection')
        private readonly logRepository: EntityRepository<SearchEngineSubmissionLog>
    ) {
        this.initGoogleAuth();
    }

    private initGoogleAuth() {
        try {
            const privateKey = this.configService.get<string>('GOOGLE_SERVICE_PRIVATE_KEY');
            const clientEmail = this.configService.get<string>('GOOGLE_SERVICE_CLIENT_EMAIL');

            if (privateKey && clientEmail) {
                this.jwtClient = new google.auth.JWT({
                    email: clientEmail,
                    key: privateKey.replace(/\\n/g, '\n'),
                    scopes: ['https://www.googleapis.com/auth/indexing'],
                });
                this.indexingApiReady = true;
                this.logger.log('Google Indexing API initialized successfully');
            } else {
                this.logger.warn('Google Auth details not provided. Indexing API skip.');
            }
        } catch (e) {
            this.logger.error(`Failed to initialize Google Auth: ${e.message}`);
        }
    }

    /**
     * Submit URL lên Google Indexing API
     */
    async submitToGoogle(url: string, type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'): Promise<SubmissionResult> {
        if (!this.indexingApiReady) {
            return { url, engine: 'Google', status: SubmissionStatus.FAILED, message: 'Google Auth not configured' };
        }

        try {
            await this.jwtClient.authorize();
            const response = await google.indexing('v3').urlNotifications.publish({
                auth: this.jwtClient,
                requestBody: { url, type }
            });

            await this.saveLog(url, 'Google', SubmissionStatus.SUCCESS, response.data);
            return { url, engine: 'Google', status: SubmissionStatus.SUCCESS };
        } catch (error) {
            this.logger.error(`Google Submit Failed for ${url}: ${error.message}`);
            await this.saveLog(url, 'Google', SubmissionStatus.FAILED, null, error.message);
            return { url, engine: 'Google', status: SubmissionStatus.FAILED, message: error.message };
        }
    }

    /**
     * Submit URL lên IndexNow (Bing, Yandex, Seznam)
     */
    async submitToIndexNow(url: string): Promise<SubmissionResult> {
        const indexNowKey = this.configService.get<string>('INDEXNOW_KEY');
        if (!indexNowKey || indexNowKey === 'erg-indexnow-default') {
            throw new InternalServerErrorException('INDEXNOW_KEY is not configured securely in environment variables. Do not use the default.');
        }
        const host = new URL(url).hostname;

        try {
            const response = await axios.post(`https://api.indexnow.org/indexnow`, {
                host,
                key: indexNowKey,
                keyLocation: `https://${host}/${indexNowKey}.txt`,
                urlList: [url]
            }, {
                headers: { 'Content-Type': 'application/json', charset: 'utf-8' }
            });

            // IndexNow returns 200, 202 if accepted
            if (response.status === 200 || response.status === 202) {
                await this.saveLog(url, 'IndexNow', SubmissionStatus.SUCCESS, response.data);
                return { url, engine: 'IndexNow', status: SubmissionStatus.SUCCESS };
            }
            throw new InternalServerErrorException(`Unexpected status code: ${response.status}`);
        } catch (error) {
            this.logger.error(`IndexNow Submit Failed for ${url}: ${error.message}`);
            await this.saveLog(url, 'IndexNow', SubmissionStatus.FAILED, null, error.message);
            return { url, engine: 'IndexNow', status: SubmissionStatus.FAILED, message: error.message };
        }
    }

    /**
     * Submit URL lên Cốc Cốc via Ping (Placeholder or actual ping if supported)
     */
    async submitToCocCoc(url: string): Promise<SubmissionResult> {
        try {
            this.logger.log(`Skipping Cốc Cốc ping for URL: ${url} - Use Webmaster Tools instead.`);
            return { url, engine: 'CocCoc', status: SubmissionStatus.SUCCESS, message: 'Skipped - Use Webmaster Tools' };
        } catch (error) {
            this.logger.error(`CocCoc Submit Failed for ${url}: ${error.message}`);
            await this.saveLog(url, 'CocCoc', SubmissionStatus.FAILED, null, error.message);
            return { url, engine: 'CocCoc', status: SubmissionStatus.FAILED, message: error.message };
        }
    }

    /**
     * Tự động Submit lên tất cả Search Engines
     */
    async submitAll(url: string, type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'): Promise<SubmissionResult[]> {
        this.logger.log(`Submitting ${url} to search engines...`);
        const results = await Promise.all([
            this.submitToGoogle(url, type),
            this.submitToIndexNow(url),
            this.submitToCocCoc(url)
        ]);
        return results;
    }

    private async saveLog(url: string, engine: string, status: SubmissionStatus, payload?: any, error?: string) {
        const log = this.logRepository.create({
            url,
            engine,
            status,
            responsePayload: payload,
            errorMessage: error
        } as any);
        await this.logRepository.getEntityManager().persistAndFlush(log);
    }

    async getSubmissionLogs(page: number = 1, limit: number = 20) {
        const [data, total] = await this.logRepository.findAndCount({}, {
            offset: (page - 1) * limit,
            limit,
            orderBy: { submittedAt: 'DESC' }
        } as any);
        return { data, total, page, limit };
    }
}
