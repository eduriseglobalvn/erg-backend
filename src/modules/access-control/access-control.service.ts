import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository, RequestContext } from '@mikro-orm/core';
import * as argon2 from 'argon2';

import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '@/modules/users/entities/user.entity';
import { UserStatus, AuthProvider } from '@/shared/enums/app.enum';

@Injectable()
export class AccessControlService implements OnModuleInit {
    private readonly logger = new Logger(AccessControlService.name);

    constructor(
        @InjectRepository(Role)
        private readonly roleRepo: EntityRepository<Role>,
        @InjectRepository(Permission)
        private readonly permissionRepo: EntityRepository<Permission>,
        @InjectRepository(User)
        private readonly userRepo: EntityRepository<User>,
        private readonly em: EntityManager, // Inject EM để tạo RequestContext
    ) { }

    async onModuleInit() {
        await RequestContext.create(this.em, async () => {
            try {
                this.logger.log('🔄 [SEED] Bắt đầu khởi tạo dữ liệu Access Control...');
                await this.seedPermissions();
                await this.seedRoles();
                await this.seedAdminUser();
                this.logger.log('✅ [SEED] Khởi tạo dữ liệu Access Control hoàn tất.');
            } catch (error) {
                this.logger.error('❌ [SEED] Lỗi khi khởi tạo dữ liệu:', error.stack);
            }
        });
    }

    // 1. Tạo Permissions mặc định
    private async seedPermissions() {
        const defaultPermissions = [
            // Users
            { name: 'users.read', description: 'View list of users' },
            { name: 'users.create', description: 'Create new user' },
            { name: 'users.update', description: 'Update user details' },
            { name: 'users.delete', description: 'Delete user' },
            { name: 'users.manage', description: 'Full access to users' },

            // Roles
            { name: 'roles.read', description: 'View roles' },
            { name: 'roles.create', description: 'Create role' },
            { name: 'roles.update', description: 'Update role' },
            { name: 'roles.delete', description: 'Delete role' },
            { name: 'roles.assign', description: 'Assign role to user' },

            // Posts
            { name: 'posts.read', description: 'View posts' },
            { name: 'posts.create', description: 'Create post' },
            { name: 'posts.update', description: 'Update post' },
            { name: 'posts.delete', description: 'Delete post' },
            { name: 'posts.publish', description: 'Publish post' },

            // System
            { name: 'system.settings', description: 'Manage system settings' },
            { name: 'system.logs', description: 'View system logs' },
        ];

        for (const p of defaultPermissions) {
            const exists = await this.permissionRepo.findOne({ name: p.name });
            if (!exists) {
                const perm = this.permissionRepo.create(p);
                this.permissionRepo.getEntityManager().persist(perm);
            }
        }
        await this.permissionRepo.getEntityManager().flush();
        this.logger.log('Permissions seeding completed.');
    }

    // 2. Tạo Roles mặc định & Gán Permissions
    private async seedRoles() {
        // A. Role USER
        let userRole = await this.roleRepo.findOne({ name: 'user' });
        if (!userRole) {
            userRole = this.roleRepo.create({
                name: 'user',
                description: 'Standard user',
            });
            this.roleRepo.getEntityManager().persist(userRole);
            // Gán quyền cơ bản cho User (nếu cần)
            // Ví dụ: posts.read
            const readPost = await this.permissionRepo.findOne({ name: 'posts.read' });
            if (readPost) userRole.permissions.add(readPost);
        }

        // B. Role EDITOR
        let editorRole = await this.roleRepo.findOne({ name: 'editor' });
        if (!editorRole) {
            editorRole = this.roleRepo.create({
                name: 'editor',
                description: 'Content Manager',
            });
            // Gán quyền Posts
            const postPerms = await this.permissionRepo.find({ name: { $like: 'posts.%' } });
            editorRole.permissions.add(postPerms);

            const userRead = await this.permissionRepo.findOne({ name: 'users.read' });
            if (userRead) editorRole.permissions.add(userRead);

            this.roleRepo.getEntityManager().persist(editorRole);
        }

        // C. Role ADMIN
        let adminRole = await this.roleRepo.findOne({ name: 'admin' });
        if (!adminRole) {
            adminRole = this.roleRepo.create({
                name: 'admin',
                description: 'Super Administrator',
            });
            // Admin có FULL quyền
            const allPerms = await this.permissionRepo.findAll();
            adminRole.permissions.add(allPerms);

            this.roleRepo.getEntityManager().persist(adminRole);
        } else {
            // Nếu Admin Role đã có, đảm bảo nó luôn có full quyền mới nhất
            const allPerms = await this.permissionRepo.findAll();
            adminRole.permissions.removeAll(); // Reset để add lại full (hoặc merge thông minh hơn)
            adminRole.permissions.add(allPerms);
        }

        await this.roleRepo.getEntityManager().flush();
        this.logger.log('Roles seeding completed.');
    }

    // 3. Tạo Admin User mặc định
    private async seedAdminUser() {
        const adminEmail = 'admin@erg.edu.vn';
        this.logger.log(`Checking for admin: ${adminEmail}`);
        const exists = await this.userRepo.findOne({ email: adminEmail });

        if (!exists) {
            const hashedPassword = await argon2.hash('Admin@2025'); // Password mặc định
            const adminRole = await this.roleRepo.findOneOrFail({ name: 'admin' });

            const adminUser = this.userRepo.create({
                email: adminEmail,
                password: hashedPassword,
                fullName: 'Super Administrator',
                provider: AuthProvider.ADMIN_CREATED,
                status: UserStatus.ACTIVE,
                isProfileCompleted: true,
                tokenVersion: 0,
                roles: [adminRole]
            });

            await this.userRepo.getEntityManager().persistAndFlush(adminUser);
            this.logger.log(`Default Admin created: ${adminEmail} / Admin@2025`);
        }
    }

    // --- MANAGEMENT APIS ---

    async findAllPermissions() {
        return this.permissionRepo.findAll({
            orderBy: { name: 'ASC' }
        });
    }

    async findAllRoles() {
        return this.roleRepo.findAll({
            populate: ['permissions'],
            orderBy: { name: 'ASC' }
        });
    }

    async createRole(dto: { name: string; description?: string; permissionIds?: string[] }) {
        const role = this.roleRepo.create({
            name: dto.name,
            description: dto.description,
        });

        if (dto.permissionIds?.length) {
            const permissions = await this.permissionRepo.find({ id: { $in: dto.permissionIds } });
            role.permissions.add(permissions);
        }

        await this.roleRepo.getEntityManager().persistAndFlush(role);
        return role;
    }

    async updateRole(id: string, dto: { name?: string; description?: string; permissionIds?: string[] }) {
        const role = await this.roleRepo.findOneOrFail(id, { populate: ['permissions'] });

        if (dto.name) role.name = dto.name;
        if (dto.description) role.description = dto.description;

        if (dto.permissionIds) {
            role.permissions.removeAll();
            const permissions = await this.permissionRepo.find({ id: { $in: dto.permissionIds } });
            role.permissions.add(permissions);
        }

        await this.roleRepo.getEntityManager().flush();
        return role;
    }

    async assignRoles(userId: string, roleIds: string[]) {
        const user = await this.userRepo.findOneOrFail(userId, { populate: ['roles'] });
        const roles = await this.roleRepo.find({ id: { $in: roleIds } });

        user.roles.removeAll();
        user.roles.add(roles);

        await this.userRepo.getEntityManager().flush();
        return user;
    }
}
