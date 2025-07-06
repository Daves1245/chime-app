import { ChimeRedisClient, getClient } from '@/services/redisClient';

// TODO checking connection via logs is strange
// there should be a better way to do this, but for now
// it works

jest.mock('@/logger', () => ({
    __esModule: true,
    default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import logger from '@/logger';

describe('Redis Client Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('ChimeRedisClient class', () => {
        test('should connect to the test redis instance as specified in the credentials', async () => {
            const redisClient = new ChimeRedisClient(true);
            await redisClient.connect();
            const client = redisClient.getClient();
            
            expect(client).toBeDefined();
            expect(logger.info).toHaveBeenCalledWith('Redis client connected successfully');
            
            await redisClient.disconnect();
        });
    });

    describe('getClient legacy function', () => {
        test('should connect to the test redis instance as specified in the credentials', async () => {
            const client = await getClient(true);
            expect(client).toBeDefined();
            expect(logger.info).toHaveBeenCalledWith('Redis client connected successfully');
        });
    });
});
