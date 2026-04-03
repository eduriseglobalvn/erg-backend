import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, NotFoundException, Logger } from '@nestjs/common';
import { RedirectService } from '../services/redirect.service';

@Catch(NotFoundException)
export class SeoRedirectFilter implements ExceptionFilter {
    private readonly logger = new Logger(SeoRedirectFilter.name);

    constructor(private readonly redirectService: RedirectService) { }

    async catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        const status = HttpStatus.NOT_FOUND;
        const url = request.originalUrl;

        try {
            const redirect = await this.redirectService.findMatch(url);

            if (redirect) {
                // Background increment
                this.redirectService.incrementHitCount(redirect).catch(e => this.logger.error('Failed to increment redirect hit count', e));

                return response.redirect(redirect.toUrl, parseInt(redirect.type) || 301);
            }
        } catch (e) {
            this.logger.error('Redirect check failed', e);
        }

        // If no redirect is matched, fall back to standard 404 response
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: (exception as any).message || 'Not Found',
            error: 'Not Found'
        });
    }
}
