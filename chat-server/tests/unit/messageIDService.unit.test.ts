// Mock dependencies before importing
const mockRedisClient = {
    incr: jest.fn().mockResolvedValue(1),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    isReady: true
};

const mockRedisClientInstance = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@/services/redisClient', () => ({
    ChimeRedisClient: jest.fn().mockImplementation(() => mockRedisClientInstance)
}));

jest.mock('@/logger', () => ({
    __esModule: true,
    default: {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
    },
}));

import { MessageIDService } from '@/services/messageIDService';
import logger from '@/logger';

describe('MessageIDService Unit Tests', () => {
    let service: MessageIDService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new MessageIDService();
    });

    describe('connect', () => {
        test('should connect to Redis successfully', async () => {
            await service.connect();

            expect(mockRedisClientInstance.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'connect' }, 'MessageIDService connected to Redis');
        });
    });

    describe('disconnect', () => {
        test('should disconnect from Redis successfully', async () => {
            await service.disconnect();

            expect(mockRedisClientInstance.disconnect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith({ function: 'disconnect' }, 'MessageIDService disconnected from Redis');
        });
    });

    describe('getNextMessageId', () => {
        test('should generate sequential message IDs for same channel', async () => {
            mockRedisClient.incr.mockResolvedValueOnce(1);
            mockRedisClient.incr.mockResolvedValueOnce(2);
            mockRedisClient.incr.mockResolvedValueOnce(3);

            const channelId = 'test-channel';

            const id1 = await service.getNextMessageId(channelId);
            const id2 = await service.getNextMessageId(channelId);
            const id3 = await service.getNextMessageId(channelId);

            expect(id1).toBe(1);
            expect(id2).toBe(2);
            expect(id3).toBe(3);

            expect(mockRedisClient.incr).toHaveBeenCalledTimes(3);
            expect(mockRedisClient.incr).toHaveBeenCalledWith('channel:test-channel:message_counter');
        });

        test('should generate independent counters for different channels', async () => {
            mockRedisClient.incr.mockResolvedValueOnce(1);
            mockRedisClient.incr.mockResolvedValueOnce(1);

            const id1 = await service.getNextMessageId('channel-1');
            const id2 = await service.getNextMessageId('channel-2');

            expect(id1).toBe(1);
            expect(id2).toBe(1);

            expect(mockRedisClient.incr).toHaveBeenCalledWith('channel:channel-1:message_counter');
            expect(mockRedisClient.incr).toHaveBeenCalledWith('channel:channel-2:message_counter');
        });

        test('should handle Redis errors gracefully', async () => {
            const redisError = new Error('Redis connection failed');
            mockRedisClient.incr.mockRejectedValueOnce(redisError);

            await expect(service.getNextMessageId('test-channel'))
                .rejects.toThrow('Redis connection failed');

            expect(logger.error).toHaveBeenCalledWith(
                { function: 'getNextMessageId', channelId: 'test-channel', error: redisError },
                'Failed to generate message ID'
            );
        });

        test('should log successful ID generation', async () => {
            mockRedisClient.incr.mockResolvedValueOnce(42);

            const messageId = await service.getNextMessageId('test-channel');

            expect(messageId).toBe(42);
            expect(logger.debug).toHaveBeenCalledWith(
                { function: 'getNextMessageId', channelId: 'test-channel', messageId: 42 },
                'Generated new message ID'
            );
        });
    });
});
