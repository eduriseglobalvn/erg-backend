import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { AuditService } from './audit.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

describe('AuditService', () => {
    let service: AuditService;
    let repo: any;

    const mockRepo = {
        create: jest.fn().mockImplementation(data => data),
        getEntityManager: jest.fn().mockReturnValue({
            persistAndFlush: jest.fn().mockResolvedValue(undefined),
        }),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                {
                    provide: getRepositoryToken(AdminAuditLog, 'mongo-connection'),
                    useValue: mockRepo,
                },
            ],
        }).compile();

        service = module.get<AuditService>(AuditService);
        repo = module.get(getRepositoryToken(AdminAuditLog, 'mongo-connection'));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('logAction', () => {
        it('should create and save a log entry', async () => {
            const auditData = {
                userId: 'user-1',
                action: 'CREATE',
                resourceType: 'Post',
                ipAddress: '127.0.0.1',
            };

            await service.logAction(auditData);

            expect(repo.create).toHaveBeenCalled();
            expect(repo.getEntityManager().persistAndFlush).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            repo.getEntityManager().persistAndFlush.mockRejectedValueOnce(new Error('DB Error'));

            // Should not throw
            await expect(service.logAction({} as any)).resolves.not.toThrow();
        });
    });

    describe('getLogs', () => {
        it('should return paginated logs', async () => {
            const logs = [{ id: '1', action: 'test' }];
            repo.findAndCount.mockResolvedValueOnce([logs, 1]);

            const result = await service.getLogs(1, 10);

            expect(result.items).toEqual(logs);
            expect(result.meta.total).toBe(1);
            expect(result.meta.totalPages).toBe(1);
            expect(repo.findAndCount).toHaveBeenCalledWith(
                {},
                expect.objectContaining({ limit: 10, offset: 0 })
            );
        });
    });
});
