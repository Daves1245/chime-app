// Mock the redis client before importing anything
const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(1),
    isReady: true,
    on: jest.fn()
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
    },
}));

import { MessageBroadcastService } from '@/services/messageBroadcaseService';
import { ChimeRedisClient } from '@/services/redisClient';
import { ChimeMessage } from '@/types/message';
import logger from '@/logger';

describe('MessageBroadcastService Unit Tests', () => {
    let service: MessageBroadcastService;
    let mockMessage: ChimeMessage;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new MessageBroadcastService();
        mockRedisClient.isReady = true;
        mockRedisClient.publish.mockResolvedValue(1);

        mockMessage = {
            channelId: 'test-channel',
            messageId: 'msg-123',
            userId: 'user-456',
            content: 'Hello, world!',
            createdAt: '2023-01-01T00:00:00Z',
            editedAt: null,
            metadata: {}
        };
    });

    describe('init', () => {
        test('should initialize Redis client successfully', async () => {
            await service.init();

            expect(mockRedisClientInstance.connect).toHaveBeenCalled();
        });

        test('should handle Redis client initialization errors', async () => {
            const initError = new Error('Redis initialization failed');
            mockRedisClientInstance.connect.mockRejectedValueOnce(initError);

            await expect(service.init()).rejects.toThrow('Redis initialization failed');
        });
    });

    describe('publish', () => {
        beforeEach(async () => {
            await service.init();
        });

        test('should broadcast message successfully', async () => {
            await service.publish(mockMessage);

            expect(mockRedisClient.publish).toHaveBeenCalledWith(
                'test-channel',
                JSON.stringify(mockMessage)
            );
            expect(logger.debug).toHaveBeenCalledWith('target channel: test-channel');
        });

        test('should throw error when not initialized', async () => {
            // Mock the uninitialized client to return null or not ready
            const mockUninitializedRedisClientInstance = {
                getClient: jest.fn().mockReturnValue({ isReady: false }),
                connect: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn().mockResolvedValue(undefined)
            };
            
            // Replace the mock for this specific test
            (ChimeRedisClient as jest.Mock).mockImplementationOnce(() => mockUninitializedRedisClientInstance);
            const testService = new MessageBroadcastService();

            await expect(testService.publish(mockMessage))
                .rejects.toThrow('Broadcast not initialized before call');
        });

        test('should throw error when client is not ready', async () => {
            mockRedisClient.isReady = false;

            await expect(service.publish(mockMessage))
                .rejects.toThrow('Broadcast not initialized before call');
        });

        test('should handle Redis publish errors', async () => {
            const publishError = new Error('Redis publish failed');
            mockRedisClient.publish.mockRejectedValueOnce(publishError);

            await expect(service.publish(mockMessage))
                .rejects.toThrow('Failed to broadcast message: Redis publish failed');

            expect(logger.error).toHaveBeenCalledWith(
                `Error broadcasting message to channel test-channel: ${publishError}`
            );
        });

        test('should broadcast to correct channel from message', async () => {
            const channelMessage = { ...mockMessage, channelId: 'different-channel' };

            await service.publish(channelMessage);

            expect(mockRedisClient.publish).toHaveBeenCalledWith(
                'different-channel',
                JSON.stringify(channelMessage)
            );
        });

        test('should serialize message correctly', async () => {
            const complexMessage = {
                ...mockMessage,
                metadata: { key1: 'value1', key2: 'value2' },
                editedAt: '2023-01-02T00:00:00Z'
            };

            await service.publish(complexMessage);

            expect(mockRedisClient.publish).toHaveBeenCalledWith(
                'test-channel',
                JSON.stringify(complexMessage)
            );
        });
    });

    describe('disconnect', () => {
        test('should disconnect Redis client', async () => {
            await service.disconnect();

            expect(mockRedisClientInstance.disconnect).toHaveBeenCalled();
        });
    });
});
