import { SetMetadata } from '@nestjs/common';

export const RESOURCE_OWNER_KEY = 'resource_owner';
export const ResourceOwner = (resourceType: string) => SetMetadata(RESOURCE_OWNER_KEY, resourceType);
