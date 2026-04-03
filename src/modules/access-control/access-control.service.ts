import { Injectable, OnModuleInit, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository, RequestContext } from '@mikro-orm/core';
import * as argon2 from 'argon2';

import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { UserPermission, PermissionAction } from './entities/user-permission.entity';
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
        @InjectRepository(PermissionGroup)
        private readonly permissionGroupRepo: EntityRepository<PermissionGroup>,
        @InjectRepository(UserPermission)
        private readonly userPermissionRepo: EntityRepository<UserPermission>,
        @InjectRepository(User)
        private readonly userRepo: EntityRepository<User>,
        private readonly em: EntityManager, // Inject EM để tạo RequestContext
    ) { }

    async onModuleInit() {
        await this.ensureAdminExists();
        this.logger.log('✅ AccessControl module initialized (Admin bootstrap check done).');
    }

    private async ensureAdminExists() {
        const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@erg.edu.vn';
        // We use the Repo from the context, or EM
        const admin = await this.userRepo.findOne({ email: adminEmail });

        if (!admin) {
            this.logger.log('[BOOT] 🚨 Admin account not found. Bootstrapping essential admin role and user...');
            await this.bootstrapAdmin();
        } else {
            // Đảm bảo admin vẫn có role admin
            const adminWithRoles = await this.userRepo.findOne({ email: adminEmail }, { populate: ['roles'] });
            const hasAdminRole = adminWithRoles?.roles.getItems().some(r => r.name === 'admin');
            if (adminWithRoles && !hasAdminRole) {
                const adminRole = await this.roleRepo.findOne({ name: 'admin' });
                if (adminRole) {
                    adminWithRoles.roles.add(adminRole);
                    await this.em.flush();
                    this.logger.log('[BOOT] Admin role re-assigned.');
                }
            }
        }
    }

    private async bootstrapAdmin() {
        // Essential bootstrap logic - 3 queries only
        const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@erg.edu.vn';

        // 1. Create essential permissions if not exist
        const essentialPerms = [
            { name: 'system.settings', description: 'Superadmin settings' },
            { name: 'users.manage', description: 'Full access to users' }
        ];

        for (const p of essentialPerms) {
            const exists = await this.permissionRepo.findOne({ name: p.name });
            if (!exists) {
                const perm = this.permissionRepo.create(p);
                this.em.persist(perm);
            }
        }

        // 2. Create admin role if not exist
        let adminRole = await this.roleRepo.findOne({ name: 'admin' });
        if (!adminRole) {
            adminRole = this.roleRepo.create({
                name: 'admin',
                description: 'Super Administrator',
            });
            this.em.persist(adminRole);
        }

        // 3. Create admin user
        const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
        if (!defaultPassword) {
            throw new Error('ADMIN_DEFAULT_PASSWORD is not defined in environment variables');
        }
        const hashedPassword = await argon2.hash(defaultPassword);
        const adminUser = this.userRepo.create({
            email: adminEmail,
            password: hashedPassword,
            fullName: 'Super Administrator',
            provider: AuthProvider.ADMIN_CREATED,
            status: UserStatus.ACTIVE,
            roles: adminRole ? [adminRole] : [],
            isProfileCompleted: true,
            tokenVersion: 0,
            loginCount: 0,
        });

        await this.em.persistAndFlush(adminUser);
        this.logger.log(`[BOOT] 🚀 Admin account bootstrapped: ${adminEmail}`);
    }

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

            // Courses
            { name: 'courses.read', description: 'View courses' },
            { name: 'courses.create', description: 'Create course' },
            { name: 'courses.update', description: 'Update course' },
            { name: 'courses.delete', description: 'Delete course' },
            { name: 'courses.publish', description: 'Publish course' },

            // Crawler
            { name: 'crawler.read', description: 'View crawler jobs' },
            { name: 'crawler.create', description: 'Create crawler job' },
            { name: 'crawler.update', description: 'Update crawler job' },
            { name: 'crawler.delete', description: 'Delete crawler job' },
            { name: 'crawler.execute', description: 'Execute crawler job' },

            // SEO
            { name: 'seo.read', description: 'View SEO data' },
            { name: 'seo.update', description: 'Update SEO data' },
            { name: 'seo.analyze', description: 'Analyze SEO' },
            { name: 'seo.manage', description: 'Manage SEO settings' },

            // Analytics
            { name: 'analytics.read', description: 'View analytics' },
            { name: 'analytics.export', description: 'Export analytics' },

            // Notifications
            { name: 'notifications.read', description: 'View notifications' },
            { name: 'notifications.manage', description: 'Manage notifications' },

            // Menus
            { name: 'menus.read', description: 'View menus' },
            { name: 'menus.create', description: 'Create menu' },
            { name: 'menus.update', description: 'Update menu' },
            { name: 'menus.delete', description: 'Delete menu' },

            // Pages
            { name: 'pages.read', description: 'View pages' },
            { name: 'pages.create', description: 'Create page' },
            { name: 'pages.update', description: 'Update page' },
            { name: 'pages.delete', description: 'Delete page' },

            // Recruitment
            { name: 'recruitment.read', description: 'View recruitment data' },
            { name: 'recruitment.create', description: 'Create recruitment data' },
            { name: 'recruitment.update', description: 'Update recruitment data' },
            { name: 'recruitment.delete', description: 'Delete recruitment data' },

            // Settings
            { name: 'settings.read', description: 'View settings' },
            { name: 'settings.update', description: 'Update settings' },

            // API Keys
            { name: 'api-keys.read', description: 'View API keys' },
            { name: 'api-keys.create', description: 'Create API key' },
            { name: 'api-keys.delete', description: 'Delete API key' },

            // Audit
            { name: 'audit.read', description: 'View audit logs' },

            // Reviews
            { name: 'reviews.read', description: 'View reviews' },
            { name: 'reviews.manage', description: 'Manage and moderate reviews' },
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

    private async seedPermissionGroups() {
        const groups = [
            {
                name: 'content_management',
                label: 'Quản lý nội dung',
                icon: 'file-text',
                sortOrder: 1,
                permissions: ['posts.*', 'courses.*', 'crawler.*', 'reviews.*'],
                featureFlags: {
                    sidebarItems: ['posts', 'courses', 'crawler', 'reviews'],
                    dashboardWidgets: ['post-stats', 'review-stats'],
                    quickActions: ['create-post', 'run-crawler']
                }
            },
            {
                name: 'seo_management',
                label: 'SEO',
                icon: 'search',
                sortOrder: 2,
                permissions: ['seo.*'],
                featureFlags: {
                    sidebarItems: ['seo-dashboard', 'seo-settings'],
                    dashboardWidgets: ['seo-overview'],
                    quickActions: ['analyze-seo']
                }
            },
            {
                name: 'user_management',
                label: 'Người dùng',
                icon: 'users',
                sortOrder: 3,
                permissions: ['users.*', 'roles.*'],
                featureFlags: {
                    sidebarItems: ['users', 'roles'],
                    dashboardWidgets: ['user-stats'],
                    quickActions: ['create-user']
                }
            },
            {
                name: 'system_settings',
                label: 'Hệ thống',
                icon: 'settings',
                sortOrder: 4,
                permissions: ['system.*', 'api-keys.*', 'audit.*', 'menus.*', 'pages.*'],
                featureFlags: {
                    sidebarItems: ['settings', 'api-keys', 'audit-logs', 'menus', 'pages'],
                    dashboardWidgets: ['system-health'],
                    quickActions: ['clear-cache']
                }
            },
            {
                name: 'recruitment',
                label: 'Tuyển dụng',
                icon: 'briefcase',
                sortOrder: 5,
                permissions: ['recruitment.*'],
                featureFlags: {
                    sidebarItems: ['jobs', 'candidates'],
                    dashboardWidgets: ['recruitment-stats'],
                    quickActions: ['create-job']
                }
            },
            {
                name: 'analytics',
                label: 'Thống kê & Báo cáo',
                icon: 'bar-chart',
                sortOrder: 6,
                permissions: ['analytics.*'],
                featureFlags: {
                    sidebarItems: ['analytics'],
                    dashboardWidgets: ['traffic-overview'],
                    quickActions: ['export-report']
                }
            }
        ];

        for (const g of groups) {
            let group = await this.permissionGroupRepo.findOne({ name: g.name });
            if (!group) {
                group = this.permissionGroupRepo.create({
                    name: g.name,
                    label: g.label,
                    icon: g.icon,
                    sortOrder: g.sortOrder,
                    featureFlags: g.featureFlags,
                });
                this.permissionGroupRepo.getEntityManager().persist(group);
            } else {
                group.label = g.label;
                group.icon = g.icon;
                group.sortOrder = g.sortOrder;
                group.featureFlags = g.featureFlags;
            }

            const permPatterns = g.permissions.map(p => p.replace('.*', '.%'));
            const perms: Permission[] = [];
            for (const pattern of permPatterns) {
                const matched = await this.permissionRepo.find({ name: { $like: pattern } });
                perms.push(...matched);
            }
            if (perms.length > 0) {
                group.permissions.removeAll();
                group.permissions.add(perms);
            }
        }
        await this.permissionGroupRepo.getEntityManager().flush();
        this.logger.log('Permission Groups seeding completed.');
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
                description: 'Post Editor',
            });
            // Gán quyền Posts
            const postPerms = await this.permissionRepo.find({ name: { $like: 'posts.%' } });
            editorRole.permissions.add(postPerms);

            const userRead = await this.permissionRepo.findOne({ name: 'users.read' });
            if (userRead) editorRole.permissions.add(userRead);

            this.roleRepo.getEntityManager().persist(editorRole);
        }

        // --- NEW ROLES ---
        // Content Manager
        let contentManagerRole = await this.roleRepo.findOne({ name: 'content_manager' });
        if (!contentManagerRole) {
            contentManagerRole = this.roleRepo.create({
                name: 'content_manager',
                description: 'Content Manager',
            });
            const contentPerms = await this.permissionRepo.find({
                name: {
                    $in: [
                        'posts.read', 'posts.create', 'posts.update', 'posts.delete', 'posts.publish',
                        'courses.read', 'courses.create', 'courses.update', 'courses.delete', 'courses.publish',
                        'crawler.read', 'crawler.create', 'crawler.update', 'crawler.delete', 'crawler.execute',
                        'seo.read', 'seo.update', 'seo.analyze', 'seo.manage'
                    ]
                }
            });
            contentManagerRole.permissions.add(contentPerms);
            this.roleRepo.getEntityManager().persist(contentManagerRole);
        }

        // SEO Specialist
        let seoRole = await this.roleRepo.findOne({ name: 'seo_specialist' });
        if (!seoRole) {
            seoRole = this.roleRepo.create({
                name: 'seo_specialist',
                description: 'SEO Specialist',
            });
            const seoPerms = await this.permissionRepo.find({
                name: { $in: ['seo.read', 'seo.update', 'seo.analyze', 'seo.manage', 'analytics.read'] }
            });
            seoRole.permissions.add(seoPerms);
            this.roleRepo.getEntityManager().persist(seoRole);
        }

        // HR Manager
        let hrRole = await this.roleRepo.findOne({ name: 'hr_manager' });
        if (!hrRole) {
            hrRole = this.roleRepo.create({
                name: 'hr_manager',
                description: 'HR Manager',
            });
            const hrPerms = await this.permissionRepo.find({
                name: { $in: ['recruitment.read', 'recruitment.create', 'recruitment.update', 'recruitment.delete', 'users.read'] }
            });
            hrRole.permissions.add(hrPerms);
            this.roleRepo.getEntityManager().persist(hrRole);
        }

        // Viewer
        let viewerRole = await this.roleRepo.findOne({ name: 'viewer' });
        if (!viewerRole) {
            viewerRole = this.roleRepo.create({
                name: 'viewer',
                description: 'Read-only Viewer',
            });
            const viewerPerms = await this.permissionRepo.find({ name: { $like: '%.read' } });
            viewerRole.permissions.add(viewerPerms);
            this.roleRepo.getEntityManager().persist(viewerRole);
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
        const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@erg.edu.vn';
        this.logger.log(`Checking for admin: ${adminEmail}`);
        const exists = await this.userRepo.findOne({ email: adminEmail });

        if (!exists) {
            const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
            if (!defaultPassword) {
                throw new Error('ADMIN_DEFAULT_PASSWORD is not defined in environment variables');
            }
            const hashedPassword = await argon2.hash(defaultPassword); // Password mặc định
            const adminRole = await this.roleRepo.findOneOrFail({ name: 'admin' });

            const adminUser = this.userRepo.create({
                email: adminEmail,
                password: hashedPassword,
                fullName: 'Super Administrator',
                provider: AuthProvider.ADMIN_CREATED,
                status: UserStatus.ACTIVE,
                isProfileCompleted: true,
                tokenVersion: 0,
                loginCount: 0,
                roles: [adminRole]
            });

            await this.userRepo.getEntityManager().persistAndFlush(adminUser);
            this.logger.log(`Default Admin created: ${adminEmail}`);
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

    async findAllPermissionGroups() {
        return this.permissionGroupRepo.findAll({
            populate: ['permissions'],
            orderBy: { sortOrder: 'ASC' }
        });
    }

    async getUserPermissionsAndFeatures(userId: string) {
        const user = await this.userRepo.findOneOrFail(userId, { populate: ['roles.permissions'] });
        const permissions = new Set<string>();

        for (const role of user.roles) {
            for (const perm of role.permissions) {
                permissions.add(perm.name);
            }
        }

        const overrides = await this.userPermissionRepo.find({ user: userId }, { populate: ['permission'] });
        overrides.forEach(o => {
            if (o.action === PermissionAction.GRANT) permissions.add(o.permission.name);
            if (o.action === PermissionAction.DENY) permissions.delete(o.permission.name);
        });

        const effectivePerms = Array.from(permissions);

        // Build feature map based on permissions
        const allGroups = await this.findAllPermissionGroups();
        const featureAccess = {
            sidebarItems: new Set<string>(),
            dashboardWidgets: new Set<string>(),
            quickActions: new Set<string>()
        };

        const isAdmin = effectivePerms.includes('system.settings'); // Proxy check for admin for now

        for (const group of allGroups) {
            // If user has at least one permission in this group, they get the UX features
            // Admin gets everything
            const hasAccess = isAdmin || group.permissions.getItems().some(p => effectivePerms.includes(p.name));

            if (hasAccess && group.featureFlags) {
                if (group.featureFlags.sidebarItems) {
                    group.featureFlags.sidebarItems.forEach((i: string) => featureAccess.sidebarItems.add(i));
                }
                if (group.featureFlags.dashboardWidgets) {
                    group.featureFlags.dashboardWidgets.forEach((i: string) => featureAccess.dashboardWidgets.add(i));
                }
                if (group.featureFlags.quickActions) {
                    group.featureFlags.quickActions.forEach((i: string) => featureAccess.quickActions.add(i));
                }
            }
        }

        return {
            permissions: effectivePerms,
            featureAccess: {
                sidebar: Array.from(featureAccess.sidebarItems),
                dashboardWidgets: Array.from(featureAccess.dashboardWidgets),
                quickActions: Array.from(featureAccess.quickActions)
            }
        };
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
        this.logger.log(`Roles for user ${userId} updated.`);
        return user;
    }

    async getUserPermissionOverrides(userId: string) {
        return this.userPermissionRepo.find({ user: { id: userId } }, { populate: ['permission'] });
    }

    async assignDirectPermissions(
        assignerId: string,
        userId: string,
        permissionsToGrant: string[] = [],
        permissionsToDeny: string[] = []
    ) {
        // [Task A1.4] Validate delegation: Check if assigner has the permission they try to grant/deny
        const assigner = await this.userRepo.findOneOrFail(assignerId, { populate: ['roles.permissions'] });
        const assignerPerms = new Set<string>();
        assigner.roles.getItems().forEach(r => r.permissions.getItems().forEach(p => assignerPerms.add(p.name)));

        const assignerOverrides = await this.userPermissionRepo.find({ user: assignerId }, { populate: ['permission'] });
        assignerOverrides.forEach(o => {
            if (o.action === PermissionAction.GRANT) assignerPerms.add(o.permission.name);
            else if (o.action === PermissionAction.DENY) assignerPerms.delete(o.permission.name);
        });

        // If assigner is not superadmin ('system.settings'), they can only assign what they themselves have
        if (!assignerPerms.has('system.settings')) {
            const allRequestedPermIds = [...permissionsToGrant, ...permissionsToDeny];
            if (allRequestedPermIds.length > 0) {
                const requestedPerms = await this.permissionRepo.find({ id: { $in: allRequestedPermIds } });
                for (const p of requestedPerms) {
                    if (!assignerPerms.has(p.name)) {
                        throw new ForbiddenException(`Cannot delegate permission '${p.name}' because you do not have it.`);
                    }
                }
            }
        }

        // Find existing overrides
        const existingOverrides = await this.userPermissionRepo.find({ user: { id: userId } }, { populate: ['permission'] });

        // Remove old overrides for the specified permissions
        const permsToUpdate = [...permissionsToGrant, ...permissionsToDeny];
        const toRemove = existingOverrides.filter(o => permsToUpdate.includes(o.permission.id));
        if (toRemove.length > 0) {
            this.userPermissionRepo.getEntityManager().remove(toRemove);
        }

        const user = await this.userRepo.findOneOrFail(userId);

        // Add Grants
        if (permissionsToGrant.length > 0) {
            const grantPerms = await this.permissionRepo.find({ id: { $in: permissionsToGrant } });
            for (const perm of grantPerms) {
                const override = this.userPermissionRepo.create({
                    user,
                    permission: perm,
                    action: PermissionAction.GRANT
                });
                this.userPermissionRepo.getEntityManager().persist(override);
            }
        }

        // Add Denies
        if (permissionsToDeny.length > 0) {
            const denyPerms = await this.permissionRepo.find({ id: { $in: permissionsToDeny } });
            for (const perm of denyPerms) {
                const override = this.userPermissionRepo.create({
                    user,
                    permission: perm,
                    action: PermissionAction.DENY
                });
                this.userPermissionRepo.getEntityManager().persist(override);
            }
        }

        await this.userPermissionRepo.getEntityManager().flush();
        this.logger.log(`Direct permissions for user ${userId} updated by ${assignerId}.`);
        return true;
    }
}
