import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Post } from '@/modules/posts/entities/post.entity';

@Injectable()
export class ResourceOwnerService {
    private readonly logger = new Logger(ResourceOwnerService.name);

    constructor(private readonly em: EntityManager) { }

    async isOwner(resourceType: string, resourceId: string, userId: string): Promise<boolean> {
        if (!resourceId || !userId) return false;

        try {
            switch (resourceType) {
                case 'post': {
                    const post = await this.em.findOne(Post, { id: resourceId }, { populate: ['createdBy'] });
                    return post?.createdBy?.id === userId;
                }
                case 'user': {
                    return resourceId === userId;
                }
                // Add more resource types here (like 'course') as they are implemented
                default:
                    this.logger.warn(`Unknown resource type for ownership check: ${resourceType}`);
                    return false;
            }
        } catch (error) {
            this.logger.error(`Error checking ownership for ${resourceType} ${resourceId}:`, error);
            return false;
        }
    }
}
