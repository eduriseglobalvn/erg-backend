import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import * as argon2 from 'argon2';
import { PostCategory } from '@/modules/posts/entities/post-category.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Role } from '@/modules/access-control/entities/role.entity';
import { Permission } from '@/modules/access-control/entities/permission.entity';
import { PermissionGroup } from '@/modules/access-control/entities/permission-group.entity';
import { UserStatus, AuthProvider, PostStatus } from '@/shared/enums/app.enum';

@Injectable()
export class SeedService {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        @InjectRepository(User) private readonly userRepo: EntityRepository<User>,
        @InjectRepository(Role) private readonly roleRepo: EntityRepository<Role>,
        @InjectRepository(Permission) private readonly permissionRepo: EntityRepository<Permission>,
        @InjectRepository(PermissionGroup) private readonly groupRepo: EntityRepository<PermissionGroup>,
        @InjectRepository(PostCategory) private readonly categoryRepo: EntityRepository<PostCategory>,
        private readonly em: EntityManager,
    ) { }

    async seedAll() {
        this.logger.log('Starting full data seed...');
        await this.seedPermissions();
        await this.seedRoles();
        await this.seedAdmin();
        await this.seedCategories();
        this.logger.log('Full seed completed.');
    }

    async seedPermissions() {
        this.logger.log('Seeding permissions...');
        // ... Copy logic from AccessControlService or keep it central here
    }

    async seedRoles() {
        this.logger.log('Seeding roles...');
    }

    async seedAdmin() {
        const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@erg.edu.vn';
        const exists = await this.userRepo.findOne({ email: adminEmail });
        if (!exists) {
            const hashedPassword = await argon2.hash('Admin@2025');
            const adminRole = await this.roleRepo.findOne({ name: 'admin' });

            const admin = this.userRepo.create({
                email: adminEmail,
                password: hashedPassword,
                fullName: 'Super Administrator',
                provider: AuthProvider.ADMIN_CREATED,
                status: UserStatus.ACTIVE,
                roles: adminRole ? [adminRole] : [],
            } as any);
            await this.em.persistAndFlush(admin);
        }
    }

    async seedCategories() {
        this.logger.log('Seeding default categories...');
    }
}
