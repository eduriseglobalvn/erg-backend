import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/core';
import { SystemConfigService } from './system-config.service';
import { SystemConfig } from './entities/system-config.entity';

describe('SystemConfigService', () => {
    let service: SystemConfigService;
    let repo: any;
    let em: any;

    const mockRepo = {
        findOne: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn().mockImplementation(data => data),
    };

    const mockEm = {
        persist: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
        removeAndFlush: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SystemConfigService,
                {
                    provide: getRepositoryToken(SystemConfig),
                    useValue: mockRepo,
                },
                {
                    provide: EntityManager,
                    useValue: mockEm,
                },
            ],
        }).compile();

        service = module.get<SystemConfigService>(SystemConfigService);
        repo = module.get(getRepositoryToken(SystemConfig));
        em = module.get(EntityManager);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('get', () => {
        it('should return value if exists', async () => {
            repo.findOne.mockResolvedValueOnce({ key: 'test', value: 'hello' });
            const result = await service.get('test');
            expect(result).toBe('hello');
        });

        it('should return default value if not exists', async () => {
            repo.findOne.mockResolvedValueOnce(null);
            const result = await service.get('test', 'default');
            expect(result).toBe('default');
        });
    });

    describe('set', () => {
        it('should update existing config', async () => {
            const config = { key: 'test', value: 'old' };
            repo.findOne.mockResolvedValueOnce(config);

            await service.set('test', 'new', 'user-1', 'desc');

            expect(config.value).toBe('new');
            expect(em.flush).toHaveBeenCalled();
        });

        it('should create new config if not exists', async () => {
            repo.findOne.mockResolvedValueOnce(null);

            await service.set('test', 'new');

            expect(repo.create).toHaveBeenCalled();
            expect(em.persist).toHaveBeenCalled();
            expect(em.flush).toHaveBeenCalled();
        });
    });

    describe('seedDefaults', () => {
        it('should seed missing defaults', async () => {
            repo.findOne.mockResolvedValue(null);

            await service.seedDefaults();

            expect(repo.create).toHaveBeenCalledTimes(5);
            expect(em.persist).toHaveBeenCalledTimes(5);
            expect(em.flush).toHaveBeenCalled();
        });
    });
});
